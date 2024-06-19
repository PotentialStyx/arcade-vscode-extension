import * as vscode from 'vscode';
import fetch from "node-fetch";

const timeCommandId = 'arcade.showTimeLeft';
const setUIDCommandId = 'arcade.setUserId';
const setStyleCommandId = 'arcade.setStyle';
const unsetUIDCommandId = 'arcade.unsetUserId';
const resetSettingsCommandId = 'arcade.resetSettings';

const userIdKey = 'arcade.userID';
const statusSizeKey = 'arcade.statusSize';
const statusTypeKey = 'arcade.statusType';


let slackUserId: string | undefined = undefined;
let statusSize: "small" | "normal" = "normal";
let statusType: "time" | "percent" = "percent";
let statusBarItem: vscode.StatusBarItem;
let timeLeft = -1;

async function updateTimeLeft(): Promise<boolean> {
	if (!slackUserId) {
		return false;
	}

	const res = await fetch(`https://hackhour.hackclub.com/api/clock/${slackUserId}`);
	const txt = await res.text();

	if (txt === "User not found") {
		vscode.window.showErrorMessage("Invalid slack user id according to Hack Club Arcade, have you ever had an arcade session?");

		slackUserId = undefined;

		return false;
	}

	timeLeft = Number.parseInt(txt);
	lastCheck = performance.now();

	return true;
}

let checks = 0;
let lastCheck = performance.now();
setInterval(() => {
	if (timeLeft >= 0) {
		const update = performance.now();
		timeLeft += lastCheck - update;
		lastCheck = update;
	}

	checks++;

	if (checks % 5 === 0) {
		renderStatus();
	}

	if (checks === 60) {
		updateTimeLeft();
		checks = 0;
	}
}, 100);

updateTimeLeft();

function getTimeSec(): number {
	if (timeLeft === -1) { return 0; }

	return Math.floor(timeLeft / 1000);
}

export async function activate({ subscriptions, globalState }: vscode.ExtensionContext) {
	globalState.setKeysForSync([userIdKey, statusSizeKey, statusTypeKey]);

	slackUserId = globalState.get(userIdKey);

	let tmpStatusSize = globalState.get(statusSizeKey);
	if (!tmpStatusSize || (tmpStatusSize !== "small" && tmpStatusSize !== "normal")) {
		tmpStatusSize = "normal";
		await globalState.update(statusSizeKey, "normal");
	}

	// eslint-disable-next-line @typescript-eslint/ban-ts-comment
	// @ts-ignore
	statusSize = tmpStatusSize;

	let tmpStatusType = globalState.get(statusTypeKey);
	if (!tmpStatusSize || (tmpStatusType !== "time" && tmpStatusType !== "percent")) {
		tmpStatusType = "time";
		await globalState.update(statusTypeKey, "time");
	}

	// eslint-disable-next-line @typescript-eslint/ban-ts-comment
	// @ts-ignore
	statusType = tmpStatusType;

	const setUIDHandler = async () => {
		const userID = await vscode.window.showInputBox({
			placeHolder: 'Enter your slack user id'
		});


		slackUserId = userID;

		if (await updateTimeLeft()) {
			await globalState.update(userIdKey, userID);
		}

		renderStatus();
	};

	subscriptions.push(vscode.commands.registerCommand(setUIDCommandId, setUIDHandler));

	subscriptions.push(vscode.commands.registerCommand(unsetUIDCommandId, async () => {
		slackUserId = undefined;

		await globalState.update(userIdKey, undefined);
		timeLeft = -1;

		renderStatus();

		vscode.window.showErrorMessage("Removed your user id");
	}));

	subscriptions.push(vscode.commands.registerCommand(resetSettingsCommandId, async () => {
		slackUserId = undefined;
		await globalState.update(userIdKey, slackUserId);

		statusSize = "normal";
		await globalState.update(statusSizeKey, statusSize);

		statusType = "time";
		await globalState.update(statusTypeKey, statusType);

		vscode.window.showWarningMessage("Reset all settings");
	}));

	subscriptions.push(vscode.commands.registerCommand(setStyleCommandId, async () => {
		const style = await vscode.window.showQuickPick(["Normal", "Small"], { canPickMany: false, placeHolder: "Select status bar item size" });

		if (!style) {
			vscode.window.showWarningMessage("Style selection cancelled");
			return;
		}

		switch (style) {
			case "Normal": {
				statusSize = "normal";
				break;
			}
			case "Small": {
				statusSize = "small";
				break;
			}
			default: {
				vscode.window.showErrorMessage("Impossible state...");
				return;
			}
		}
		await globalState.update(statusSizeKey, statusSize);

		const type = await vscode.window.showQuickPick(["Timer", "Percent Done"], { canPickMany: false, placeHolder: "Select status bar item type" });

		if (!type) {
			vscode.window.showWarningMessage("Style selection cancelled");
			return;
		}

		switch (type) {
			case "Timer": {
				statusType = "time";
				break;
			}
			case "Percent Done": {
				statusType = "percent";
				break;
			}
			default: {
				vscode.window.showErrorMessage("Impossible state #2...");
				return;
			}
		}

		await globalState.update(statusTypeKey, statusType);

		renderStatus();
	}));

	subscriptions.push(vscode.commands.registerCommand(timeCommandId, () => {
		if (!slackUserId) {
			setUIDHandler();
			return;
		}

		const left = getTimeSec();

		if (left === 0) {
			vscode.window.showInformationMessage(`The Hack Club Arcade API says there is no active session right now.\nThis could mean you have a paused session or just haven't started one yet.\n\nGO AND START/RESUME A SESSION!!!!!`);
		} else if (left < 0) {
			vscode.window.showWarningMessage(`The Hack Club Arcade API has glitched and said you have negative time left! This is caused by a desync when pausing, sorry for the inconvenience, there is nothing you can do about this. (Just for fun, the Arcade API api says you have ${left} seconds left)`);
		} else {
			const percent = Math.floor(((60 * 60) - left) / (60 * 60) * 1000) / 10;

			const min = Math.trunc(left / 60);

			vscode.window.showInformationMessage(`You are ${percent}% done with your current arcade session!\nYou have completed ${60 - min} / 60 minutes`);
			updateTimeLeft();
		}
	}));

	statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
	statusBarItem.command = timeCommandId;
	subscriptions.push(statusBarItem);

	await updateTimeLeft();

	renderStatus();
}

function renderNoID(): string {
	// extensions-info-message

	switch (statusSize) {
		case "small": {
			return "$(warning) No ID!";
		}
		case "normal": {
			return "$(warning) Set your slack user id!";
		}
	}
}

function renderNoSession(): string {
	switch (statusSize) {
		case "small": {
			return "$(debug-restart) Get Hacking!";
		}
		case "normal": {
			return "$(debug-restart) Go start/resume an arcade session!";
		}
	}
}

function renderGlitchedTime(left: number): string {
	switch (statusSize) {
		case "small": {
			return `$(warning) Oh No!`;
		}
		case "normal": {
			return `$(warning) Arcade API glitched, click for info`;
		}
	}
}

function renderTime(left: number): string {
	const min = Math.trunc(left / 60);
	const sec = (left % 60).toString().padStart(2, "0");

	switch (statusSize) {
		case "small": {
			return `$(watch) ${min}:${sec}`;
		}
		case "normal": {
			return `$(clock) Arcade session time left: ${min}:${sec}`;
		}
	}
}

function renderPercent(left: number): string {
	const percentNum = Math.floor(((60 * 60) - left) / (60 * 60) * 1000) / 10;

	let percent = percentNum.toString();

	if (percent.length === 2) {
		percent += ".0";
	}

	switch (statusSize) {
		case "small": {
			return `$(clock) ${percent}%`;
		}
		case "normal": {
			return `$(clock) Arcade session is ${percent}% done`;
		}
	}
}

function renderStatus() {
	statusBarItem.show();

	if (!slackUserId) {
		statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
		statusBarItem.text = renderNoID();
		return;
	}

	const left = getTimeSec();
	statusBarItem.backgroundColor = undefined;

	if (left === 0) {
		statusBarItem.text = renderNoSession();
		return;
	} else if (left < 0) {
		statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
		statusBarItem.text = renderGlitchedTime(left);
		return;
	}

	switch (statusType) {
		case "time": {
			statusBarItem.text = renderTime(left);
			break;
		}
		case "percent": {
			statusBarItem.text = renderPercent(left);
			break;
		}
	}
}
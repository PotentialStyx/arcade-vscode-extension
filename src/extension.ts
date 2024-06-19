import * as vscode from 'vscode';
import fetch from "node-fetch";

let slackUserId: string | undefined = undefined;// "U06LKBCRLDA";
const timeCommandId = 'arcade.showTimeLeft';
const setUIDCommandId = 'arcade.setUserId';
const unsetUIDCommandId = 'arcade.unsetUserId';
const userIdKey = 'arcade.userID';

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
		updateStatusBarItem();
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
	globalState.setKeysForSync([userIdKey]);

	slackUserId = globalState.get(userIdKey);

	subscriptions.push(vscode.commands.registerCommand(setUIDCommandId, async () => {
		const userID = await vscode.window.showInputBox({
			placeHolder: 'Enter your slack user id'
		});


		slackUserId = userID;

		if (await updateTimeLeft()) {
			globalState.update(userIdKey, userID);
		}

		updateStatusBarItem();
	}));

	subscriptions.push(vscode.commands.registerCommand(unsetUIDCommandId, async () => {
		slackUserId = undefined;

		globalState.update(userIdKey, undefined);
		timeLeft = -1;

		updateStatusBarItem();

		vscode.window.showErrorMessage("Removed your user id");
	}));

	subscriptions.push(vscode.commands.registerCommand(timeCommandId, () => {
		const left = getTimeSec();

		if (left === 0) {
			vscode.window.showInformationMessage(`The Hack Club Arcade API says there is no active session right now.\nThis could mean you have a paused session or just haven't started one yet.\n\nGO AND START/RESUME A SESSION!!!!!`);
		} else {
			const percent = Math.floor(((60 * 60) - left) / (60 * 60) * 1000) / 10;

			const min = Math.trunc(left / 60);

			vscode.window.showInformationMessage(`You are ${percent}% done with your current arcade session!\nYou have completed ${60 - min} / 60 minutes`);
			updateTimeLeft();
		}

	}));

	statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
	subscriptions.push(statusBarItem);

	await updateTimeLeft();

	updateStatusBarItem();
}

function updateStatusBarItem(): void {
	statusBarItem.show();

	if (!slackUserId) {
		statusBarItem.text = "$(extensions-info-message) Set your slack user id!";
		statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
		statusBarItem.command = setUIDCommandId;
		return;
	}

	statusBarItem.command = timeCommandId;
	statusBarItem.backgroundColor = undefined;

	const left = getTimeSec();

	if (left !== 0) {
		const min = Math.trunc(left / 60);
		const sec = (left % 60).toString().padStart(2, "0");
		statusBarItem.text = `$(testing-queued-icon) Arcade session time left: ${min}:${sec}`;
	} else {
		statusBarItem.text = "$(debug-restart) Go start/resume an arcade session!";
	}
}
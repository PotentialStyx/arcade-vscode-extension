import * as vscode from 'vscode';
import fetch from "node-fetch";

const SLACK_ID = "U06LKBCRLDA";
const commandId = 'arcade.showTimeLeft';

let statusBarItem: vscode.StatusBarItem;
let timeLeft = -1;

async function updateTimeLeft() {
	const res = await fetch(`https://hackhour.hackclub.com/api/clock/${SLACK_ID}`);
	timeLeft = Number.parseInt(await res.text());
	lastCheck = performance.now();
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

	if (checks % 50 === 0) {
		updateStatusBarItem();
	}

	if (checks === 600) {
		updateTimeLeft();
		checks = 0;
	}
}, 10);
updateTimeLeft();

function getTimeSec(): number {
	if (timeLeft === -1) { return 0; }

	return Math.floor(timeLeft / 1000);
}

export function activate({ subscriptions }: vscode.ExtensionContext) {
	subscriptions.push(vscode.commands.registerCommand(commandId, () => {
		const left = getTimeSec();

		if (left === 0) {
			vscode.window.showInformationMessage(`The Hack Club Arcade API says there is no active session right now.\nThis could mean you have a paused session or just haven't started one yet.\n\nGO AND START/RESUME A SESSION!!!!!`);
		} else {

			const percent = Math.floor(((60 * 60) - left) / (60 * 60) * 1000) / 10;

			const min = Math.trunc(left / 60);

			vscode.window.showInformationMessage(`You are ${percent}% done with your current arcade session!       \nYou have completed ${min} / 60 minutes`);
			updateTimeLeft();
		}
	}));

	statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
	statusBarItem.command = commandId;
	subscriptions.push(statusBarItem);

	updateStatusBarItem();
}

function updateStatusBarItem(): void {
	statusBarItem.show();

	const left = getTimeSec();

	if (left !== 0) {
		const min = Math.trunc(left / 60);
		const sec = (left % 60).toString().padStart(2, "0");
		statusBarItem.text = `$(clock) Arcade session time left: ${min}:${sec}`;
	} else {
		statusBarItem.text = "$(debug-restart) Go start/resume an arcade session!";
	}
}
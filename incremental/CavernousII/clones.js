const SYNC_GAP = 250;

class Clone {
	constructor(id){
		this.id = id;
		this.createTimeline();
		this.reset();
		this.createQueue();
	}

	enterZone() {
		this.x = 0;
		this.y = 0;
		this.walkTime = 0;
		this.startDamage = this.damage;
		this.minHealth = 0;
		this.waiting = false;
		this.noSync = false;
	}

	reset() {
		this.enterZone();
		this.currentProgress = 0;
		this.damage = 0;
		this.styleDamage();
		this.repeated = false;
		this.activeSpells = [];
		this.resetTimeLine()
	}

	resetTimeLine() {
		for (var i = 0; i < this.timeLines.length; i++) {
			this.timeLines[i] = []
			while (this.timeLineElements[i].firstChild) {
				this.timeLineElements[i].removeChild(this.timeLineElements[i].lastChild);
			}
		}
	}

	takeDamage(amount) {
		if (this.activeSpells.find(spell => spell.name == "Arcane Shield") && amount > 0){
			let mana = getStat("Mana");
			if (mana.current < amount){
				mana.spendMana(mana.current);
				amount -= mana.current;
			} else {
				mana.spendMana(amount);
				amount = 0;
			}
		}
		if (getStat("Health").current - this.damage > 0.1){
			this.damage = Math.min(getStat("Health").current - 0.05, this.damage + amount);
		} else {
			this.damage += amount;
		}
		this.minHealth = Math.min(this.minHealth, this.startDamage - this.damage);
		if (this.damage < 0) this.damage = 0;
		if (this.damage >= getStat("Health").current){
			this.damage = Infinity;
			getMessage("Death").display();
			if (clones.every(c => c.damage == Infinity && c.x == this.x && c.y == this.y)){
				let route = getBestRoute(this.x, this.y, currentZone);
				if (route){
					route.allDead = true;
				}
			}
		}
		this.styleDamage();
	}

	styleDamage() {
		if (!this.el) return;
		let hp = 1 - Math.min((this.damage / getStat("Health").current));
		this.el.querySelector(".damage").style.width = hp == 1 || !Number.isFinite(hp) ? "0" : (hp * 100) + "%";
		if (hp < 0) this.el.classList.add('dead-clone');
		else this.el.classList.remove('dead-clone');
	}

	createQueue() {
		let queueTemplate = document.querySelector("#queue-template");
		this.el = queueTemplate.cloneNode(true);
		this.el.id = `queue${clones.length}`;
		document.querySelector("#queues").append(this.el);
		let q = new ActionQueue();
		q.index = queues.length;
		queues.push(q);
	}

	createTimeline(){
		this.timeLines = []
		let timelineTemplate = document.querySelector("#timeline-template");
		this.timeLineElements = []
		for (let i = 0;i < zones.length; i++){
			this.timeLines[i] = []
			this.timeLineElements[i] = timelineTemplate.cloneNode(true);
			this.timeLineElements[i].id = `zone${i+1}-timeline${clones.length}`;
			document.querySelector("#timelines").append(this.timeLineElements[i]);
		}
	}

	select(allowMultiple = false) {
		if (!allowMultiple) {
			for (let index of selectedQueue) {
				if (index != this.id) clones[index].deselect();
			}
			if (cursor[0] != this.id){
				cursor = [this.id, null];
			}
			selectedQueue = [this.id];
		} else {
			cursor = [0, null];
		}

		document.querySelector(`#queue${this.id}`).classList.add("selected-clone");
		if (!selectedQueue.includes(this.id)) {
			selectedQueue.push(this.id)
		}

	}

	deselect() {
		document.querySelector(`#queue${this.id}`).classList.remove("selected-clone");
		if (cursor[0] == this.id)
			cursor[1] = null;
		selectedQueue = selectedQueue.filter(e => e != this.id);
	}

	completeNextAction(force) {
		return completeNextAction(force);
	}

	selectQueueAction(actionIndex, n) {
		if (currentZone == displayZone){
			selectQueueAction(this.id, actionIndex, n);
		}
	}

	sustainSpells(time) {
		this.activeSpells.forEach(s => s.sustain(time));
	}

	drown(time) {
		let location = zones[currentZone].getMapLocation(this.x, this.y, true);
		if (location.water) this.takeDamage(location.water ** 2 * time / 1000);
	}

	addToTimeline(action, time = 0){
		if (action === null || isNaN(time)) return;
		// Loop log
		if (!loopActions[action.name]) loopActions[action.name] = 0;
		loopActions[action.name] += time;

		// Timeline
		if (!settings.timeline) return;
		let lastEntry = this.timeLines[currentZone][this.timeLines[currentZone].length - 1];
		if (lastEntry?.type == action.name){
			lastEntry.time += time;
			lastEntry.el.dataset.time = Math.round(lastEntry.time);
			lastEntry.el.style.flexGrow = lastEntry.time;
		} else {
			let entryElement = document.createElement('div');
			entryElement.dataset.name = action.name;
			entryElement.dataset.time = Math.round(time);
			entryElement.style.flexGrow = time;
			entryElement.classList.add(action.name.replace(/ /g, '-'));
			this.timeLineElements[currentZone].append(entryElement);
			this.timeLines[currentZone].push({type: action.name, time: time, el: entryElement});
		}
	}

	getNextActionTime() {
		currentClone = this.id;
		let [action, actionIndex] = getNextAction();
		if (action === undefined){
			// No actions available
			this.noActionsAvailable = true;
			return [Infinity, null, null];
		}
		let actionToDo = action.action;
		if (actionToDo === null){
			// Pathfinding or repeat interact is done
			return [0, null, null];
		}
		if (actionToDo[0] === undefined || actionToDo[0][0] === "W"){
			// Clone is waiting
			return [Infinity, null, null];
		}
		if (actionToDo[0][0] == "=") {
			if (!this.waiting || clones.every((c, i) => {
					return (c.noSync === true || c.waiting === true || (c.waiting && c.waiting >= queueTime - SYNC_GAP)) || !queues[i].find(q => q[0] == "=" && q[1])
					})){
				return [0, null, null];
			} else {
				return [Infinity, null, null];
			}
		}
		if (this.waiting !== false && this.waiting < queueTime - SYNC_GAP) this.waiting = false;

		let actionXOffset = {
			"R": 1,
			"L": -1,
		}[actionToDo[0]] || 0;
		let actionYOffset = {
			"U": -1,
			"D": 1,
		}[actionToDo[0]] || 0;
		let hasOffset = !!actionXOffset || !!actionYOffset;
		let x = this.x + actionXOffset, y = this.y + actionYOffset;
		let location = getMapLocation(x, y);
		if (actionToDo[0][0] == "N" && (runes[actionToDo[1]].isInscribable() <= 0 && !runesTiles.includes(zones[currentZone].map[y + zones[currentZone].yOffset][x + zones[currentZone].xOffset]))){
			return [Infinity, null, null];
		}
		if ("NS<+".includes(actionToDo[0][0]) || (actionToDo[0][0] == "=" && this.waiting !== true)){
			// Clone's next action is free.
			return [0, null, null];
		}
		if (hasOffset) {
			let enterTime = location.type.getEnterAction(location.entered)?.getProjectedDuration(1, 0, location.remainingEnter || 0, x, y);
			if (isNaN(enterTime)) enterTime = 100;
			return [enterTime, x, y, ["Walk", "Kudzu Chop"].includes(location.type.getEnterAction(location.entered)?.name) || !location.type.canWorkTogether];
		} else {
			let presentTime =
				location.type.presentAction?.getProjectedDuration(1, 0, location.remainingPresent || 0, x, y) || // Time a new action takes
				location.temporaryPresent?.getProjectedDuration(1, 0, location.remainingPresent || 0, x, y) || // Time a new rune action takes
				0; // Illegal present action
			if (isNaN(presentTime)) presentTime = 100;
			return [presentTime, x, y];
		}
	}

	executeAction(time, action, actionIndex) {
		let initialTime = time
		currentClone = this.id;
		let actionToDo = action.action;
		// Failed pathfind
		if (actionToDo === null || actionToDo[0] === undefined){
			this.completeNextAction(true);
			return time;
		}
		// Explicit wait
		if (actionToDo[0] === "W"){
			this.addToTimeline({name: "Wait"}, initialTime);
			return 0;
		}

		let actionXOffset = {
			"R": 1,
			"L": -1,
		}[actionToDo[0]] || 0;
		let actionYOffset = {
			"U": -1,
			"D": 1,
		}[actionToDo[0]] || 0;
		let hasOffset = !!actionXOffset || !!actionYOffset;

		if (actionToDo[0][0] == "N"){
			if (runes[actionToDo[1]].create(this.x + actionXOffset, this.y + actionYOffset)){
				this.selectQueueAction(actionIndex, 100);
				this.completeNextAction();
				this.addToTimeline({name: "Create rune"});
				return time;
			} else {
				this.addToTimeline({name: "Wait"}, initialTime);
				return 0;
			}
		}
		if (actionToDo[0][0] == "S"){
			if (spells[actionToDo[1]].cast()){
				this.selectQueueAction(actionIndex, 100);
				this.completeNextAction();
				this.addToTimeline({name: "Cast spell"});
				return time;
			} else {
				this.addToTimeline({name: "Wait"}, initialTime);
				return 0;
			}
		}
		if (actionToDo == "<") {
			this.completeNextAction();
			return time;
		}
		if (actionToDo == "+") {
			this.noSync = !this.noSync;
			this.selectQueueAction(actionIndex, 100);
			this.completeNextAction();
			return time;
		}
		if (actionToDo == "=") {
			if (this.noSync){
				this.selectQueueAction(actionIndex, 100);
				this.completeNextAction();
				return time;
			}
			this.waiting = true;
			if (clones.every((c, i) => {
					return (c.noSync === true || c.waiting === true || (c.waiting && c.waiting >= queueTime - SYNC_GAP)) || !queues[i].find(q => q[0] == "=" && q[1])
				})){
				this.waiting = queueTime;
				this.selectQueueAction(actionIndex, 100);
				this.completeNextAction();
				this.addToTimeline({name: "Sync"});
				return time;
			}
			this.addToTimeline({name: "Wait"}, initialTime);
			return 0;
		}

		let location = getMapLocation(this.x + actionXOffset, this.y + actionYOffset);
		let locationEnterAction = location.type.getEnterAction(location.entered);
		if (this.currentCompletions === null) this.currentCompletions = location.completions;

		if (!hasOffset && this.currentCompletions !== null && (this.currentCompletions < location.completions && location.temporaryPresent?.name != "Teleport")) {
			this.completeNextAction();
			this.currentProgress = 0;
			this.selectQueueAction(actionIndex, 100);
			this.addToTimeline(!hasOffset ? (location.type.presentAction || location.temporaryPresent) : locationEnterAction, initialTime - time);
			return time;
		}
		if ((location.remainingPresent <= 0 && !hasOffset) || (location.remainingEnter <= 0 && hasOffset)) {
			let startStatus = location.start();
			if (startStatus == 0){
				this.completeNextAction();
				this.currentProgress = 0;
				this.selectQueueAction(actionIndex, 100);
				this.addToTimeline(!hasOffset ? (location.type.presentAction || location.temporaryPresent) : locationEnterAction, initialTime - time);
				return time;
			} else if (startStatus < 0){
				this.addToTimeline({name: "Wait"}, initialTime);
				if (time < 1) this.timeAvailable = time;
				return 0;
			}
		}
		let percentRemaining;
		[time, percentRemaining] = location.tick(time);
		this.selectQueueAction(actionIndex, 100 - (percentRemaining * 100));
		this.currentProgress = location.remainingPresent;
		if (!percentRemaining){
			this.completeNextAction();
			this.currentProgress = 0;
		}
		this.addToTimeline(!hasOffset ? (location.type.presentAction || location.temporaryPresent) : locationEnterAction, initialTime - time);
		return time;
	}

	get queue() {
		return queues[this.id];
	}

	performSingleAction(maxTime) {
		if (maxTime > this.timeAvailable){
			maxTime = this.timeAvailable;
		}
		if (this.noActionsAvailable || this.damage == Infinity){
			if (this.damage == Infinity){
				this.addToTimeline({name: "Dead"}, maxTime);
			} else {
				this.addToTimeline({name: "No action"}, maxTime);
			}
			this.timeAvailable = 0;
			return;
		}
		currentClone = this.id;
		let [nextAction, actionIndex] = getNextAction();

		if (nextAction) {
			let timeLeft = this.executeAction(maxTime, nextAction, actionIndex);
			this.sustainSpells(maxTime - timeLeft);
			this.drown(maxTime - timeLeft);
			this.timeAvailable -= (maxTime - timeLeft);
			return;
		} 

		let repeat = this.queue.findIndex(q => q[0] == "<");
		if (repeat > -1 && this.repeatsThisTick < 10) {
			this.repeated = true;
			this.repeatsThisTick++;
			for (let i = repeat + 1; i < this.queue.length; i++){
				this.queue[i][1] = true;
				if (this.queue[i][2]){
					for (let inner of this.queue[i][2]) {
						delete inner[`${currentClone}_${i}`];
					}
				}
				this.selectQueueAction(i, 0);
			}
			this.drown(this.timeAvailable - maxTime);
			this.timeAvailable -= maxTime;
			return;
		}

		this.noActionsAvailable = true;
		this.drown(this.timeAvailable);
		this.timeAvailable = 0;
		this.addToTimeline({name: "No action"}, maxTime);
		return;
	}

	setTimeAvalable(time) {
		this.timeAvailable = time;
		this.noActionsAvailable = false;
		this.repeatsThisTick = 0;
	}

	static performActions(time) {
		for (let c of clones) {
			c.setTimeAvalable(time);
		}

		let maxTime = time;
		while (maxTime) {
			let nextActionTimes = clones.map(c => c.noActionsAvailable || c.damage == Infinity || !(c.timeAvailable || 0) ? [Infinity, null, null] : c.getNextActionTime())
			    .map((t, i, arr) => t[3] ? t[0] : t[0] / arr.reduce((a, c) => a + (c[1] === t[1] && c[2] === t[2]), 0));
			let nextSingleActionTime = Math.min(...nextActionTimes);
			clones.filter((c, i) => nextActionTimes[i] == nextSingleActionTime).forEach(c => c.performSingleAction(nextSingleActionTime + 0.001));
			maxTime = Math.max(...clones.map((e, i) => !e.noActionsAvailable && e.damage != Infinity && nextActionTimes[i] < Infinity && (e.timeAvailable || 0)));
			if (maxTime < 0.001) break;
		}

		let timeNotSpent = Math.min(...clones.map(e => e.timeAvailable || 0));
		clones.forEach(c => {
			if (c.timeAvailable > timeNotSpent){
				c.sustainSpells(c.timeAvailable - timeNotSpent);
				if (c.noActionsAvailable){
					c.addToTimeline({name: "No action"}, c.timeAvailable - timeNotSpent);
				} else {
					c.addToTimeline({name: "Wait"}, c.timeAvailable - timeNotSpent);
				}
			}
		})
		queueTime += time - timeNotSpent;
		getStat("Mana").spendMana((time - timeNotSpent) / 1000);
		return timeNotSpent;
	}

	static addNewClone(loading = false) {
		let c = new Clone(clones.length);
		clones.push(c);
		if (!loading){
			if (clones.length == 2) getMessage("First Clone").display();
			if (clones.length == 3) getMessage("Second Clone").display();
			if (clones.length == 4) getMessage("Third Clone").display();
			if (clones.length == 5) getMessage("Fourth Clone").display();
		}
	}
}

function selectClone(target, event){
	if (target.id) {
		let index = +target.id.replace("queue", "");
		if (event && (event.ctrlKey || event.metaKey)) {
			if (selectedQueue.includes(index)) {
				clones[index].deselect();
			} else {
				clones[index].select(true);
			}
		} else {
			clones[index].select();
		}
	} else {
		clones[target].select();
	}
	
	showCursor();
	showFinalLocation();
}

let clones = [];

class Stat {
	constructor(name, icon, description, base = 0, learnable = true){
		this.name = name;
		this.icon = icon;
		this.description = description;
		this.current = this.base = base;
		this.learnable = learnable;
		this.bonus = 0;
		this.node = null;
		this.value = 1;
// 		setTimeout(() => {
// 			this.update();
// 		}, 10);
	}

	updateValue() {
		this.value = 100 / (100 + this.current + this.bonus);
	}

	gainSkill(amount) {
		this.current += amount / 10;
		this.update();
	}

	setStat(amount) {
		// For combat stats.
		this.current = this.base + amount;
		this.update();
	}

	update(updateZero) {
		this.updateValue();
		if ((this.current === 0 && !updateZero) && this.name !== "Mana") return;
		if (this.name == "Runic Lore"){
			updateRunes(this.current);
		}
		if (!this.node){
			this.createNode();
		}
		if (this.name == "Mana"){
			this.node.querySelector(".effect").innerHTML = writeNumber(this.current + this.bonus, 1) + "/" + writeNumber(this.base, 1);
		} else if (!this.learnable){
			this.node.querySelector(".effect").innerHTML = writeNumber(this.current + this.bonus, 1);
		} else {
			this.node.querySelector(".effect").innerHTML = `${writeNumber(this.current + this.bonus, 2)} (${writeNumber(this.base, 2)})`;
			this.node.querySelector(".description").innerHTML = this.description + ` (${writeNumber(100 - this.value * 100, 1)}%)`;
		}
	}

	createNode() {
		let statTemplate = document.querySelector("#stat-template");
		this.node = statTemplate.cloneNode(true);
		this.node.id = "stat_" + this.name;
		this.node.querySelector(".name").innerHTML = this.name;
		this.node.querySelector(".icon").innerHTML = this.icon;
		this.node.querySelector(".description").innerHTML = this.description;
		document.querySelector("#stats").appendChild(this.node);
		if (this.name == "Runic Lore"){
			document.querySelector("#runes").style.display = "block";
		}
	}

	reset() {
		this.base = this.getNextLoopValue();
		let isDecreasing = this.current > 0;
		this.current = this.base;
		this.bonus = 0;
		this.update(isDecreasing);
	}

	getNextLoopValue() {
		if (!this.learnable) return this.base;
		let increase = (Math.pow(this.current + 1, 0.9) - (this.base + 1)) / 100;
		return this.base + (increase > 0 ? increase : 0);
	}

	spendMana(amount) {
		if (this.name != "Mana") return;
		this.current -= amount;
		this.update();
	}
}

let stats = [
	new Stat("Mana", "", "How long you can resist being pulled back to your cave.", 5, false),
	new Stat("Mining", "⛏", "Your skill at mining, reducing the time it takes to do mining-type tasks."),
	new Stat("Magic", "★", "Your understanding of arcane mysteries."),
	new Stat("Speed", "", "How quick you are."),
	new Stat("Smithing", "🛠", "Your skill at turning raw ores into usable objects."),
	new Stat("Runic Lore", "🕮", "A measure of your understanding of magical runes."),
	new Stat("Combat", "", "Your ability to kill things.", 0),
	new Stat("Attack", "", "How much damage your wild flailing does. (Weapons increase all clones' stats)", 0, false),
	new Stat("Defense", "", "How well you avoid taking damage. (Shields increase all clones' stats)", 0, false),
	new Stat("Health", "", "How many hits you can take until you're nothing more than meat. (Armour increases all clones' stats)", 10, false),
];

function getStat(name) {
	return stats.find(a => a.name == name);
}
let currentZone = 0;

class Zone {
	constructor(name, map, challengeReward = null){
		this.name = name;
		this.originalMap = map;
		this.challengeReward = challengeReward;
		this.map = map.slice();
		this.yOffset = map.findIndex(row => row.includes("."));
		this.xOffset = map[this.yOffset].indexOf(".");
		this.mapLocations = [];
		this.manaGain = 0;
		this.queues = null;
		this.routes = [];
		this.routesChanged = true;
		this.node = null;
		this.startStuff = [];

		while (this.mapLocations.length < map.length){
			this.mapLocations.push([]);
		}
	}

	getMapLocation(x, y, adj = false){
		if (!adj && this.map[y + this.yOffset][x + this.xOffset] != "█"){
			this.getMapLocation(x-1, y-1, true);
			this.getMapLocation(x, y-1, true);
			this.getMapLocation(x+1, y-1, true);
			this.getMapLocation(x-1, y, true);
			this.getMapLocation(x+1, y, true);
			this.getMapLocation(x-1, y+1, true);
			this.getMapLocation(x, y+1, true);
			this.getMapLocation(x+1, y+1, true);
		}
		x += this.xOffset;
		y += this.yOffset;
		if (x < 0 || x >= this.map[0].length || y < 0 || y >= this.map.length) return;
		if (!this.mapLocations[y][x]){
			let mapSymbol = this.map[y][x];
			this.mapLocations[y][x] = new Location(x - this.xOffset, y - this.yOffset, getLocationTypeBySymbol(mapSymbol));
			classMapping[mapSymbol][2] ? mapStain.push([x, y]) : mapDirt.push([x, y]);
		}
		return this.mapLocations[y][x];
	}

	hasMapLocation(x, y) {
		return this.mapLocations[y] && this.mapLocations[y][x] != undefined;
	}

	resetZone(){
		this.map = this.originalMap.slice();
		this.mapLocations.forEach((ml, y) => {
			ml.forEach((l, x) => {
				l.reset();
			});
		});
	}

	mineComplete(){
		this.manaGain = +(this.manaGain + 0.1).toFixed(2);
		let mana = getStat("Mana");
		mana.base = +(mana.base + 0.1).toFixed(2);
		mana.current += 0.1;
	}

	exitZone(){
		// Replace only routes which are strictly worse than an existing one.
		this.lastRoute = new ZoneRoute(this);
		if (!this.routes.some(r => r.isBetter(this.lastRoute))){
			this.routesChanged = true;
			for (let i = 0; i < this.routes.length; i++){
				if (this.lastRoute.isBetter(this.routes[i])){
					this.routes.splice(i, 1);
					i--;
				}
			}
			this.routes.push(this.lastRoute);
		}
		this.display();
	}

	loadBestRoute(requirements){
		let possible = this.routes.filter(r => r.isBetter(requirements));
		if (possible.length == 0){
			// If we can't make it work, just pick the one which gives us the most mana.
			// The route we want has probably been deleted.
			let bestMana = Math.max(...this.routes.map(p => p.mana));
			this.routes.find(r => r.mana == bestMana).loadRoute(this);
			return;
		}
		let bestMana = Math.max(...possible.map(p => p.mana));
		this.routes.find(r => r.mana == bestMana).loadRoute(this);
	}

	enterZone(){
		this.display();
		if (this.name == "Zone 2" && getMessage("Enter Zone")){
			if (settings.running) toggleRunning();
		}
		let mana = getStat("Mana");
		mana.current += this.manaGain;
		mana.base += this.manaGain;
		if (this.queues === null){
			this.queues = ActionQueue.fromJSON([[]]);
		}
		while (this.queues.length < clones.length){
			let q = new ActionQueue();
			q.index = this.queues.length;
			this.queues.push(q);
		}
		queues = this.queues;
		queues.forEach((_, i) => {
			resetQueueHighlight(i);
		});
		clones.forEach(c => c.enterZone());
		redrawQueues();
		isDrawn = false;
		this.getMapLocation(0, 0);
		this.mapLocations.forEach((ml, y) => {
			ml.forEach((l, x) => {
				mapDirt.push([x, y]);
			});
		});
		skipActionComplete = true;
		this.startStuff = stuff.filter(s => s.count > 0).map(s => {
			s.resetMin();
			return {
				"name": s.name,
				"count": s.count
			};
		});
	}

	display(){
		if (!this.node){
			this.node = document.querySelector("#zone-template").cloneNode(true);
			this.node.removeAttribute("id");
			let zoneSelect = document.querySelector("#zone-select");
			zoneSelect.appendChild(this.node);
		}
		this.node.querySelector(".name").innerHTML = this.name;
		this.node.querySelector(".mana").innerHTML = `+${this.manaGain}`;
		this.onclick = () => {throw "VIEWING OTHER MAPS NOT IMPLEMENTED"};
		if (this.routesChanged){
			let parent = this.node.querySelector(".routes");
			while (parent.firstChild){
				parent.removeChild(parent.lastChild);
			}
			let routeTemplate = document.querySelector("#zone-route-template");
			parent.style.display = this.routes.length ? "block" : "none";
			for (let i = 0; i < this.routes.length; i++){
				let routeNode = routeTemplate.cloneNode(true);
				routeNode.removeAttribute("id");
				routeNode.querySelector(".mana").innerHTML = this.routes[i].mana.toFixed(2);
				routeNode.querySelector(".stuff").innerHTML = this.routes[i].stuff.map(s => `${s[1]}${getStuff(s[0]).icon}`);
				routeNode.onclick = this.routes[i].loadRoute.bind(this);
				parent.appendChild(routeNode);
			}
		}
	}
}

function moveToZone(zone){
	if (typeof(zone) == "string"){
		zone = zones.findIndex(z => z.name == zone);
	}
	zones[currentZone].exitZone();
	currentZone = zone;
	zones[zone].enterZone();
}

let zones = [
	new Zone("Zone 1",
		[
			'████████████',
			'█««###███♥██',
			'█«█#######██',
			'█«█####██#██',
			'█«█Θ#███¤#██',
			'█«████.##███',
			'█«█+#██##¤██',
			'█«█###██##██',
			'█«█#+#██#+██',
			'█«█+#####███',
			'█√████=█¤███',
			'████████████',
		],
		null,
	),
	new Zone("Zone 2",
		[
			'████████████',
			'██=+###+##%█',
			'██###█#█████',
			'█¤##█¤#«««██',
			'██##██ ██«██',
			'██##██.#««██',
			'██##¤█###███',
			'██+#██#█#%██',
			'███ █⎶###%██',
			'███#███╬+███',
			'█√ #Θ███████',
			'████████████',
		],
		null,
	),
];

import { DND4EBETA } from "../config.js";

/**
 * A helper class for building MeasuredTemplates for 4e spells and abilities
 * @extends {MeasuredTemplate}
 */
export default class AbilityTemplate extends MeasuredTemplate {

	/**
	 * A factory method to create an AbilityTemplate instance using provided data from an Item4e instance
	 * @param {Item4e} item                             The Item object for which to construct the template
	 * @return {AbilityTemplate|null}         The template object, or null if the item does not produce a template
	 */
	static fromItem(item) {
		// const target = getProperty(item.data, "data.target") || {};
		// const templateShape = DND4EBETA.areaTargetTypes[target.type];
		const templateShape = DND4EBETA.areaTargetTypes[item.data.data.rangeType];
	
		let distance = item.data.data.area;
		let flag = templateShape;

		if(item.data.data.rangeType === "closeBlast" || item.data.data.rangeType === "rangeBlast") {
			distance *= Math.sqrt(2);
		}
		else if(item.data.data.rangeType === "rangeBurst") {
			flag = "rectCenter";
			distance += 0.5;
		}
		else if(item.data.data.rangeType === "closeBurst") {
			flag = "rectCenter";
			switch(item.parent.data.data.details.size) {
				case 'tiny':
				case 'sm':
				case 'med':
					distance += 0.5;
					break;
				case 'lg':
					distance += 1;
					break;
				case  'huge':
					distance += 1.5;
					break;
				case 'grg':
					distance += 2;
					break;
				default:
					distance = Math.sqrt(2) * ( 1 + 2*distance);
			}
		}
		// if(item.data.data.rangeType === "closeBurst" || item.data.data.rangeType === "rangeBurst") distance = Math.sqrt(2) * ( 1 + 2*distance);
	
		if ( !templateShape ) return null;

		// Prepare template data
		const templateData = {
			t: templateShape,
			user: game.user.id,
			distance: distance,
			direction: 0,
			x: 0,
			y: 0,
			fillColor: game.user.color,
			flags: {dnd4e:{templateType:flag}}
		};

		// Additional type-specific data
		switch ( templateShape ) {
			case "cone": // 4e cone RAW should be 53.13 degrees
				templateData.angle = 53.13;
				break;
			case "rect": // 4e rectangular AoEs are always cubes
				// templateData.distance = Math.hypot(target.value, target.value);
				// templateData.width = target.value;
				templateData.direction = 45;
				break;
			case "ray": // 4e rays are most commonly 1 square (5 ft) in width
				templateData.width = canvas.dimensions.distance;
				break;
			default:
				break;
		}

		// Return the template constructed from the item data
		const cls = CONFIG.MeasuredTemplate.documentClass;
		const template = new cls(templateData, {parent: canvas.scene});
		const object = new this(template);
		object.item = item;
		object.actorSheet = item.actor?.sheet || null;
		return object;
	}

	/* -------------------------------------------- */

	/**
	 * Creates a preview of the spell template
	 */
	drawPreview() {
		const initialLayer = canvas.activeLayer;
		this.draw();
		this.layer.activate();
		this.layer.preview.addChild(this);
		this.activatePreviewListeners(initialLayer);
	}

	/* -------------------------------------------- */

	/**
	 * Activate listeners for the template preview
	 * @param {CanvasLayer} initialLayer    The initially active CanvasLayer to re-activate after the workflow is complete
	 */
	 activatePreviewListeners(initialLayer) {
		const handlers = {};
		let moveTime = 0;

		// Update placement (mouse-move)
		handlers.mm = event => {
			event.stopPropagation();
			let now = Date.now(); // Apply a 20ms throttle
			if ( now - moveTime <= 20 ) return;
			const center = event.data.getLocalPosition(this.layer);
			const snapped = canvas.grid.getSnappedPosition(center.x, center.y, 2);
			this.data.update({x: snapped.x, y: snapped.y});
			this.refresh();
			moveTime = now;
		};

		// Cancel the workflow (right-click)
		handlers.rc = event => {
			this.layer._onDragLeftCancel(event);
			canvas.stage.off("mousemove", handlers.mm);
			canvas.stage.off("mousedown", handlers.lc);
			canvas.app.view.oncontextmenu = null;
			canvas.app.view.onwheel = null;
			initialLayer.activate();
			this.actorSheet?.maximize();
		};

		// Confirm the workflow (left-click)
		handlers.lc = event => {
			handlers.rc(event);
			const destination = canvas.grid.getSnappedPosition(this.data.x, this.data.y, 2);
			this.data.update(destination);
			canvas.scene.createEmbeddedDocuments("MeasuredTemplate", [this.data]);
		};

		// Rotate the template by 3 degree increments (mouse-wheel)
		handlers.mw = event => {
			if ( event.ctrlKey ) event.preventDefault(); // Avoid zooming the browser window
			event.stopPropagation();
			let delta = canvas.grid.type > CONST.GRID_TYPES.SQUARE ? 30 : 15;
			let snap = event.shiftKey ? delta : 5;
			this.data.update({direction: this.data.direction + (snap * Math.sign(event.deltaY))});
			this.refresh();
		};

		// Activate listeners
		canvas.stage.on("mousemove", handlers.mm);
		canvas.stage.on("mousedown", handlers.lc);
		canvas.app.view.oncontextmenu = handlers.rc;
		canvas.app.view.onwheel = handlers.mw;
	}
}

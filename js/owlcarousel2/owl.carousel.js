/**
 * Owl Carousel v2.3.4
 * Copyright 2013-2018 David Deutsch
 * Licensed under: SEE LICENSE IN https://github.com/OwlCarousel2/OwlCarousel2/blob/master/LICENSE
 */
/**
 * Owl carousel
 * @version 2.3.4
 * @author Bartosz Wojciechowski
 * @author David Deutsch
 * @license The MIT License (MIT)
 * @todo Lazy Load Icon
 * @todo prevent animationend bubling
 * @todo itemsScaleUp
 * @todo Test Zepto
 * @todo stagePadding calculate wrong active classes
 */
;(function($, window, document, undefined) {

	/**
	 * Creates a carousel.
	 * @class The Owl Carousel.
	 * @public
	 * @param {HTMLElement|jQuery} element - The element to create the carousel for.
	 * @param {Object} [options] - The options
	 */
	function Owl(element, options) {

		/**
		 * Current settings for the carousel.
		 * @public
		 */
		this.settings = null;

		/**
		 * Current options set by the caller including defaults.
		 * @public
		 */
		this.options = $.extend({}, Owl.Defaults, options);

		/**
		 * Plugin element.
		 * @public
		 */
		this.$element = $(element);

		/**
		 * Proxied event handlers.
		 * @protected
		 */
		this._handlers = {};

		/**
		 * References to the running plugins of this carousel.
		 * @protected
		 */
		this._plugins = {};

		/**
		 * Currently suppressed events to prevent them from being retriggered.
		 * @protected
		 */
		this._supress = {};

		/**
		 * Absolute current position.
		 * @protected
		 */
		this._current = null;

		/**
		 * Animation speed in milliseconds.
		 * @protected
		 */
		this._speed = null;

		/**
		 * Coordinates of all items in pixel.
		 * @todo The name of this member is missleading.
		 * @protected
		 */
		this._coordinates = [];

		/**
		 * Current breakpoint.
		 * @todo Real media queries would be nice.
		 * @protected
		 */
		this._breakpoint = null;

		/**
		 * Current width of the plugin element.
		 */
		this._width = null;

		/**
		 * All real items.
		 * @protected
		 */
		this._items = [];

		/**
		 * All cloned items.
		 * @protected
		 */
		this._clones = [];

		/**
		 * Merge values of all items.
		 * @todo Maybe this could be part of a plugin.
		 * @protected
		 */
		this._mergers = [];

		/**
		 * Widths of all items.
		 */
		this._widths = [];

		/**
		 * Invalidated parts within the update process.
		 * @protected
		 */
		this._invalidated = {};

		/**
		 * Ordered list of workers for the update process.
		 * @protected
		 */
		this._pipe = [];

		/**
		 * Current state information for the drag operation.
		 * @todo #261
		 * @protected
		 */
		this._drag = {
			time: null,
			target: null,
			pointer: null,
			stage: {
				start: null,
				current: null
			},
			direction: null
		};

		/**
		 * Current state information and their tags.
		 * @type {Object}
		 * @protected
		 */
		this._states = {
			current: {},
			tags: {
				'initializing': [ 'busy' ],
				'animating': [ 'busy' ],
				'dragging': [ 'interacting' ]
			}
		};

		$.each([ 'onResize', 'onThrottledResize' ], $.proxy(function(i, handler) {
			this._handlers[handler] = $.proxy(this[handler], this);
		}, this));

		$.each(Owl.Plugins, $.proxy(function(key, plugin) {
			this._plugins[key.charAt(0).toLowerCase() + key.slice(1)]
				= new plugin(this);
		}, this));

		$.each(Owl.Workers, $.proxy(function(priority, worker) {
			this._pipe.push({
				'filter': worker.filter,
				'run': $.proxy(worker.run, this)
			});
		}, this));

		this.setup();
		this.initialize();
	}

	/**
	 * Default options for the carousel.
	 * @public
	 */
	Owl.Defaults = {
		items: 3,
		loop: false,
		center: false,
		rewind: false,
		checkVisibility: true,

		mouseDrag: true,
		touchDrag: true,
		pullDrag: true,
		freeDrag: false,

		margin: 0,
		stagePadding: 0,

		merge: false,
		mergeFit: true,
		autoWidth: false,

		startPosition: 0,
		rtl: false,

		smartSpeed: 250,
		fluidSpeed: false,
		dragEndSpeed: false,

		responsive: {},
		responsiveRefreshRate: 200,
		responsiveBaseElement: window,

		fallbackEasing: 'swing',
		slideTransition: '',

		info: false,

		nestedItemSelector: false,
		itemElement: 'div',
		stageElement: 'div',

		refreshClass: 'owl-refresh',
		loadedClass: 'owl-loaded',
		loadingClass: 'owl-loading',
		rtlClass: 'owl-rtl',
		responsiveClass: 'owl-responsive',
		dragClass: 'owl-drag',
		itemClass: 'owl-item',
		stageClass: 'owl-stage',
		stageOuterClass: 'owl-stage-outer',
		grabClass: 'owl-grab'
	};

	/**
	 * Enumeration for width.
	 * @public
	 * @readonly
	 * @enum {String}
	 */
	Owl.Width = {
		Default: 'default',
		Inner: 'inner',
		Outer: 'outer'
	};

	/**
	 * Enumeration for types.
	 * @public
	 * @readonly
	 * @enum {String}
	 */
	Owl.Type = {
		Event: 'event',
		State: 'state'
	};

	/**
	 * Contains all registered plugins.
	 * @public
	 */
	Owl.Plugins = {};

	/**
	 * List of workers involved in the update process.
	 */
	Owl.Workers = [ {
		filter: [ 'width', 'settings' ],
		run: function() {
			this._width = this.$element.width();
		}
	}, {
		filter: [ 'width', 'items', 'settings' ],
		run: function(cache) {
			cache.current = this._items && this._items[this.relative(this._current)];
		}
	}, {
		filter: [ 'items', 'settings' ],
		run: function() {
			this.$stage.children('.cloned').remove();
		}
	}, {
		filter: [ 'width', 'items', 'settings' ],
		run: function(cache) {
			var margin = this.settings.margin || '',
				grid = !this.settings.autoWidth,
				rtl = this.settings.rtl,
				css = {
					'width': 'auto',
					'margin-left': rtl ? margin : '',
					'margin-right': rtl ? '' : margin
				};

			!grid && this.$stage.children().css(css);

			cache.css = css;
		}
	}, {
		filter: [ 'width', 'items', 'settings' ],
		run: function(cache) {
			var width = (this.width() / this.settings.items).toFixed(3) - this.settings.margin,
				merge = null,
				iterator = this._items.length,
				grid = !this.settings.autoWidth,
				widths = [];

			cache.items = {
				merge: false,
				width: width
			};

			while (iterator--) {
				merge = this._mergers[iterator];
				merge = this.settings.mergeFit && Math.min(merge, this.settings.items) || merge;

				cache.items.merge = merge > 1 || cache.items.merge;

				widths[iterator] = !grid ? this._items[iterator].width() : width * merge;
			}

			this._widths = widths;
		}
	}, {
		filter: [ 'items', 'settings' ],
		run: function() {
			var clones = [],
				items = this._items,
				settings = this.settings,
				// TODO: Should be computed from number of min width items in stage
				view = Math.max(settings.items * 2, 4),
				size = Math.ceil(items.length / 2) * 2,
				repeat = settings.loop && items.length ? settings.rewind ? view : Math.max(view, size) : 0,
				append = '',
				prepend = '';

			repeat /= 2;

			while (repeat > 0) {
				// Switch to only using appended clones
				clones.push(this.normalize(clones.length / 2, true));
				append = append + items[clones[clones.length - 1]][0].outerHTML;
				clones.push(this.normalize(items.length - 1 - (clones.length - 1) / 2, true));
				prepend = items[clones[clones.length - 1]][0].outerHTML + prepend;
				repeat -= 1;
			}

			this._clones = clones;

			$(append).addClass('cloned').appendTo(this.$stage);
			$(prepend).addClass('cloned').prependTo(this.$stage);
		}
	}, {
		filter: [ 'width', 'items', 'settings' ],
		run: function() {
			var rtl = this.settings.rtl ? 1 : -1,
				size = this._clones.length + this._items.length,
				iterator = -1,
				previous = 0,
				current = 0,
				coordinates = [];

			while (++iterator < size) {
				previous = coordinates[iterator - 1] || 0;
				current = this._widths[this.relative(iterator)] + this.settings.margin;
				coordinates.push(previous + current * rtl);
			}

			this._coordinates = coordinates;
		}
	}, {
		filter: [ 'width', 'items', 'settings' ],
		run: function() {
			var padding = this.settings.stagePadding,
				coordinates = this._coordinates,
				css = {
					'width': Math.ceil(Math.abs(coordinates[coordinates.length - 1])) + padding * 2,
					'padding-left': padding || '',
					'padding-right': padding || ''
				};

			this.$stage.css(css);
		}
	}, {
		filter: [ 'width', 'items', 'settings' ],
		run: function(cache) {
			var iterator = this._coordinates.length,
				grid = !this.settings.autoWidth,
				items = this.$stage.children();

			if (grid && cache.items.merge) {
				while (iterator--) {
					cache.css.width = this._widths[this.relative(iterator)];
					items.eq(iterator).css(cache.css);
				}
			} else if (grid) {
				cache.css.width = cache.items.width;
				items.css(cache.css);
			}
		}
	}, {
		filter: [ 'items' ],
		run: function() {
			this._coordinates.length < 1 && this.$stage.removeAttr('style');
		}
	}, {
		filter: [ 'width', 'items', 'settings' ],
		run: function(cache) {
			cache.current = cache.current ? this.$stage.children().index(cache.current) : 0;
			cache.current = Math.max(this.minimum(), Math.min(this.maximum(), cache.current));
			this.reset(cache.current);
		}
	}, {
		filter: [ 'position' ],
		run: function() {
			this.animate(this.coordinates(this._current));
		}
	}, {
		filter: [ 'width', 'position', 'items', 'settings' ],
		run: function() {
			var rtl = this.settings.rtl ? 1 : -1,
				padding = this.settings.stagePadding * 2,
				begin = this.coordinates(this.current()) + padding,
				end = begin + this.width() * rtl,
				inner, outer, matches = [], i, n;

			for (i = 0, n = this._coordinates.length; i < n; i++) {
				inner = this._coordinates[i - 1] || 0;
				outer = Math.abs(this._coordinates[i]) + padding * rtl;

				if ((this.op(inner, '<=', begin) && (this.op(inner, '>', end)))
					|| (this.op(outer, '<', begin) && this.op(outer, '>', end))) {
					matches.push(i);
				}
			}

			this.$stage.children('.active').removeClass('active');
			this.$stage.children(':eq(' + matches.join('), :eq(') + ')').addClass('active');

			this.$stage.children('.center').removeClass('center');
			if (this.settings.center) {
				this.$stage.children().eq(this.current()).addClass('center');
			}
		}
	} ];

	/**
	 * Create the stage DOM element
	 */
	Owl.prototype.initializeStage = function() {
		this.$stage = this.$element.find('.' + this.settings.stageClass);

		// if the stage is already in the DOM, grab it and skip stage initialization
		if (this.$stage.length) {
			return;
		}

		this.$element.addClass(this.options.loadingClass);

		// create stage
		this.$stage = $('<' + this.settings.stageElement + '>', {
			"class": this.settings.stageClass
		}).wrap( $( '<div/>', {
			"class": this.settings.stageOuterClass
		}));

		// append stage
		this.$element.append(this.$stage.parent());
	};

	/**
	 * Create item DOM elements
	 */
	Owl.prototype.initializeItems = function() {
		var $items = this.$element.find('.owl-item');

		// if the items are already in the DOM, grab them and skip item initialization
		if ($items.length) {
			this._items = $items.get().map(function(item) {
				return $(item);
			});

			this._mergers = this._items.map(function() {
				return 1;
			});

			this.refresh();

			return;
		}

		// append content
		this.replace(this.$element.children().not(this.$stage.parent()));

		// check visibility
		if (this.isVisible()) {
			// update view
			this.refresh();
		} else {
			// invalidate width
			this.invalidate('width');
		}

		this.$element
			.removeClass(this.options.loadingClass)
			.addClass(this.options.loadedClass);
	};

	/**
	 * Initializes the carousel.
	 * @protected
	 */
	Owl.prototype.initialize = function() {
		this.enter('initializing');
		this.trigger('initialize');

		this.$element.toggleClass(this.settings.rtlClass, this.settings.rtl);

		if (this.settings.autoWidth && !this.is('pre-loading')) {
			var imgs, nestedSelector, width;
			imgs = this.$element.find('img');
			nestedSelector = this.settings.nestedItemSelector ? '.' + this.settings.nestedItemSelector : undefined;
			width = this.$element.children(nestedSelector).width();

			if (imgs.length && width <= 0) {
				this.preloadAutoWidthImages(imgs);
			}
		}

		this.initializeStage();
		this.initializeItems();

		// register event handlers
		this.registerEventHandlers();

		this.leave('initializing');
		this.trigger('initialized');
	};

	/**
	 * @returns {Boolean} visibility of $element
	 *                    if you know the carousel will always be visible you can set `checkVisibility` to `false` to
	 *                    prevent the expensive browser layout forced reflow the $element.is(':visible') does
	 */
	Owl.prototype.isVisible = function() {
		return this.settings.checkVisibility
			? this.$element.is(':visible')
			: true;
	};

	/**
	 * Setups the current settings.
	 * @todo Remove responsive classes. Why should adaptive designs be brought into IE8?
	 * @todo Support for media queries by using `matchMedia` would be nice.
	 * @public
	 */
	Owl.prototype.setup = function() {
		var viewport = this.viewport(),
			overwrites = this.options.responsive,
			match = -1,
			settings = null;

		if (!overwrites) {
			settings = $.extend({}, this.options);
		} else {
			$.each(overwrites, function(breakpoint) {
				if (breakpoint <= viewport && breakpoint > match) {
					match = Number(breakpoint);
				}
			});

			settings = $.extend({}, this.options, overwrites[match]);
			if (typeof settings.stagePadding === 'function') {
				settings.stagePadding = settings.stagePadding();
			}
			delete settings.responsive;

			// responsive class
			if (settings.responsiveClass) {
				this.$element.attr('class',
					this.$element.attr('class').replace(new RegExp('(' + this.options.responsiveClass + '-)\\S+\\s', 'g'), '$1' + match)
				);
			}
		}

		this.trigger('change', { property: { name: 'settings', value: settings } });
		this._breakpoint = match;
		this.settings = settings;
		this.invalidate('settings');
		this.trigger('changed', { property: { name: 'settings', value: this.settings } });
	};

	/**
	 * Updates option logic if necessery.
	 * @protected
	 */
	Owl.prototype.optionsLogic = function() {
		if (this.settings.autoWidth) {
			this.settings.stagePadding = false;
			this.settings.merge = false;
		}
	};

	/**
	 * Prepares an item before add.
	 * @todo Rename event parameter `content` to `item`.
	 * @protected
	 * @returns {jQuery|HTMLElement} - The item container.
	 */
	Owl.prototype.prepare = function(item) {
		var event = this.trigger('prepare', { content: item });

		if (!event.data) {
			event.data = $('<' + this.settings.itemElement + '/>')
				.addClass(this.options.itemClass).append(item)
		}

		this.trigger('prepared', { content: event.data });

		return event.data;
	};

	/**
	 * Updates the view.
	 * @public
	 */
	Owl.prototype.update = function() {
		var i = 0,
			n = this._pipe.length,
			filter = $.proxy(function(p) { return this[p] }, this._invalidated),
			cache = {};

		while (i < n) {
			if (this._invalidated.all || $.grep(this._pipe[i].filter, filter).length > 0) {
				this._pipe[i].run(cache);
			}
			i++;
		}

		this._invalidated = {};

		!this.is('valid') && this.enter('valid');
	};

	/**
	 * Gets the width of the view.
	 * @public
	 * @param {Owl.Width} [dimension=Owl.Width.Default] - The dimension to return.
	 * @returns {Number} - The width of the view in pixel.
	 */
	Owl.prototype.width = function(dimension) {
		dimension = dimension || Owl.Width.Default;
		switch (dimension) {
			case Owl.Width.Inner:
			case Owl.Width.Outer:
				return this._width;
			default:
				return this._width - this.settings.stagePadding * 2 + this.settings.margin;
		}
	};

	/**
	 * Refreshes the carousel primarily for adaptive purposes.
	 * @public
	 */
	Owl.prototype.refresh = function() {
		this.enter('refreshing');
		this.trigger('refresh');

		this.setup();

		this.optionsLogic();

		this.$element.addClass(this.options.refreshClass);

		this.update();

		this.$element.removeClass(this.options.refreshClass);

		this.leave('refreshing');
		this.trigger('refreshed');
	};

	/**
	 * Checks window `resize` event.
	 * @protected
	 */
	Owl.prototype.onThrottledResize = function() {
		window.clearTimeout(this.resizeTimer);
		this.resizeTimer = window.setTimeout(this._handlers.onResize, this.settings.responsiveRefreshRate);
	};

	/**
	 * Checks window `resize` event.
	 * @protected
	 */
	Owl.prototype.onResize = function() {
		if (!this._items.length) {
			return false;
		}

		if (this._width === this.$element.width()) {
			return false;
		}

		if (!this.isVisible()) {
			return false;
		}

		this.enter('resizing');

		if (this.trigger('resize').isDefaultPrevented()) {
			this.leave('resizing');
			return false;
		}

		this.invalidate('width');

		this.refresh();

		this.leave('resizing');
		this.trigger('resized');
	};

	/**
	 * Registers event handlers.
	 * @todo Check `msPointerEnabled`
	 * @todo #261
	 * @protected
	 */
	Owl.prototype.registerEventHandlers = function() {
		if ($.support.transition) {
			this.$stage.on($.support.transition.end + '.owl.core', $.proxy(this.onTransitionEnd, this));
		}

		if (this.settings.responsive !== false) {
			this.on(window, 'resize', this._handlers.onThrottledResize);
		}

		if (this.settings.mouseDrag) {
			this.$element.addClass(this.options.dragClass);
			this.$stage.on('mousedown.owl.core', $.proxy(this.onDragStart, this));
			this.$stage.on('dragstart.owl.core selectstart.owl.core', function() { return false });
		}

		if (this.settings.touchDrag){
			this.$stage.on('touchstart.owl.core', $.proxy(this.onDragStart, this));
			this.$stage.on('touchcancel.owl.core', $.proxy(this.onDragEnd, this));
		}
	};

	/**
	 * Handles `touchstart` and `mousedown` events.
	 * @todo Horizontal swipe threshold as option
	 * @todo #261
	 * @protected
	 * @param {Event} event - The event arguments.
	 */
	Owl.prototype.onDragStart = function(event) {
		var stage = null;

		if (event.which === 3) {
			return;
		}

		if ($.support.transform) {
			stage = this.$stage.css('transform').replace(/.*\(|\)| /g, '').split(',');
			stage = {
				x: stage[stage.length === 16 ? 12 : 4],
				y: stage[stage.length === 16 ? 13 : 5]
			};
		} else {
			stage = this.$stage.position();
			stage = {
				x: this.settings.rtl ?
					stage.left + this.$stage.width() - this.width() + this.settings.margin :
					stage.left,
				y: stage.top
			};
		}

		if (this.is('animating')) {
			$.support.transform ? this.animate(stage.x) : this.$stage.stop()
			this.invalidate('position');
		}

		this.$element.toggleClass(this.options.grabClass, event.type === 'mousedown');

		this.speed(0);

		this._drag.time = new Date().getTime();
		this._drag.target = $(event.target);
		this._drag.stage.start = stage;
		this._drag.stage.current = stage;
		this._drag.pointer = this.pointer(event);

		$(document).on('mouseup.owl.core touchend.owl.core', $.proxy(this.onDragEnd, this));

		$(document).one('mousemove.owl.core touchmove.owl.core', $.proxy(function(event) {
			var delta = this.difference(this._drag.pointer, this.pointer(event));

			$(document).on('mousemove.owl.core touchmove.owl.core', $.proxy(this.onDragMove, this));

			if (Math.abs(delta.x) < Math.abs(delta.y) && this.is('valid')) {
				return;
			}

			event.preventDefault();

			this.enter('dragging');
			this.trigger('drag');
		}, this));
	};

	/**
	 * Handles the `touchmove` and `mousemove` events.
	 * @todo #261
	 * @protected
	 * @param {Event} event - The event arguments.
	 */
	Owl.prototype.onDragMove = function(event) {
		var minimum = null,
			maximum = null,
			pull = null,
			delta = this.difference(this._drag.pointer, this.pointer(event)),
			stage = this.difference(this._drag.stage.start, delta);

		if (!this.is('dragging')) {
			return;
		}

		event.preventDefault();

		if (this.settings.loop) {
			minimum = this.coordinates(this.minimum());
			maximum = this.coordinates(this.maximum() + 1) - minimum;
			stage.x = (((stage.x - minimum) % maximum + maximum) % maximum) + minimum;
		} else {
			minimum = this.settings.rtl ? this.coordinates(this.maximum()) : this.coordinates(this.minimum());
			maximum = this.settings.rtl ? this.coordinates(this.minimum()) : this.coordinates(this.maximum());
			pull = this.settings.pullDrag ? -1 * delta.x / 5 : 0;
			stage.x = Math.max(Math.min(stage.x, minimum + pull), maximum + pull);
		}

		this._drag.stage.current = stage;

		this.animate(stage.x);
	};

	/**
	 * Handles the `touchend` and `mouseup` events.
	 * @todo #261
	 * @todo Threshold for click event
	 * @protected
	 * @param {Event} event - The event arguments.
	 */
	Owl.prototype.onDragEnd = function(event) {
		var delta = this.difference(this._drag.pointer, this.pointer(event)),
			stage = this._drag.stage.current,
			direction = delta.x > 0 ^ this.settings.rtl ? 'left' : 'right';

		$(document).off('.owl.core');

		this.$element.removeClass(this.options.grabClass);

		if (delta.x !== 0 && this.is('dragging') || !this.is('valid')) {
			this.speed(this.settings.dragEndSpeed || this.settings.smartSpeed);
			this.current(this.closest(stage.x, delta.x !== 0 ? direction : this._drag.direction));
			this.invalidate('position');
			this.update();

			this._drag.direction = direction;

			if (Math.abs(delta.x) > 3 || new Date().getTime() - this._drag.time > 300) {
				this._drag.target.one('click.owl.core', function() { return false; });
			}
		}

		if (!this.is('dragging')) {
			return;
		}

		this.leave('dragging');
		this.trigger('dragged');
	};

	/**
	 * Gets absolute position of the closest item for a coordinate.
	 * @todo Setting `freeDrag` makes `closest` not reusable. See #165.
	 * @protected
	 * @param {Number} coordinate - The coordinate in pixel.
	 * @param {String} direction - The direction to check for the closest item. Ether `left` or `right`.
	 * @return {Number} - The absolute position of the closest item.
	 */
	Owl.prototype.closest = function(coordinate, direction) {
		var position = -1,
			pull = 30,
			width = this.width(),
			coordinates = this.coordinates();

		if (!this.settings.freeDrag) {
			// check closest item
			$.each(coordinates, $.proxy(function(index, value) {
				// on a left pull, check on current index
				if (direction === 'left' && coordinate > value - pull && coordinate < value + pull) {
					position = index;
				// on a right pull, check on previous index
				// to do so, subtract width from value and set position = index + 1
				} else if (direction === 'right' && coordinate > value - width - pull && coordinate < value - width + pull) {
					position = index + 1;
				} else if (this.op(coordinate, '<', value)
					&& this.op(coordinate, '>', coordinates[index + 1] !== undefined ? coordinates[index + 1] : value - width)) {
					position = direction === 'left' ? index + 1 : index;
				}
				return position === -1;
			}, this));
		}

		if (!this.settings.loop) {
			// non loop boundries
			if (this.op(coordinate, '>', coordinates[this.minimum()])) {
				position = coordinate = this.minimum();
			} else if (this.op(coordinate, '<', coordinates[this.maximum()])) {
				position = coordinate = this.maximum();
			}
		}

		return position;
	};

	/**
	 * Animates the stage.
	 * @todo #270
	 * @public
	 * @param {Number} coordinate - The coordinate in pixels.
	 */
	Owl.prototype.animate = function(coordinate) {
		var animate = this.speed() > 0;

		this.is('animating') && this.onTransitionEnd();

		if (animate) {
			this.enter('animating');
			this.trigger('translate');
		}

		if ($.support.transform3d && $.support.transition) {
			this.$stage.css({
				transform: 'translate3d(' + coordinate + 'px,0px,0px)',
				transition: (this.speed() / 1000) + 's' + (
					this.settings.slideTransition ? ' ' + this.settings.slideTransition : ''
				)
			});
		} else if (animate) {
			this.$stage.animate({
				left: coordinate + 'px'
			}, this.speed(), this.settings.fallbackEasing, $.proxy(this.onTransitionEnd, this));
		} else {
			this.$stage.css({
				left: coordinate + 'px'
			});
		}
	};

	/**
	 * Checks whether the carousel is in a specific state or not.
	 * @param {String} state - The state to check.
	 * @returns {Boolean} - The flag which indicates if the carousel is busy.
	 */
	Owl.prototype.is = function(state) {
		return this._states.current[state] && this._states.current[state] > 0;
	};

	/**
	 * Sets the absolute position of the current item.
	 * @public
	 * @param {Number} [position] - The new absolute position or nothing to leave it unchanged.
	 * @returns {Number} - The absolute position of the current item.
	 */
	Owl.prototype.current = function(position) {
		if (position === undefined) {
			return this._current;
		}

		if (this._items.length === 0) {
			return undefined;
		}

		position = this.normalize(position);

		if (this._current !== position) {
			var event = this.trigger('change', { property: { name: 'position', value: position } });

			if (event.data !== undefined) {
				position = this.normalize(event.data);
			}

			this._current = position;

			this.invalidate('position');

			this.trigger('changed', { property: { name: 'position', value: this._current } });
		}

		return this._current;
	};

	/**
	 * Invalidates the given part of the update routine.
	 * @param {String} [part] - The part to invalidate.
	 * @returns {Array.<String>} - The invalidated parts.
	 */
	Owl.prototype.invalidate = function(part) {
		if ($.type(part) === 'string') {
			this._invalidated[part] = true;
			this.is('valid') && this.leave('valid');
		}
		return $.map(this._invalidated, function(v, i) { return i });
	};

	/**
	 * Resets the absolute position of the current item.
	 * @public
	 * @param {Number} position - The absolute position of the new item.
	 */
	Owl.prototype.reset = function(position) {
		position = this.normalize(position);

		if (position === undefined) {
			return;
		}

		this._speed = 0;
		this._current = position;

		this.suppress([ 'translate', 'translated' ]);

		this.animate(this.coordinates(position));

		this.release([ 'translate', 'translated' ]);
	};

	/**
	 * Normalizes an absolute or a relative position of an item.
	 * @public
	 * @param {Number} position - The absolute or relative position to normalize.
	 * @param {Boolean} [relative=false] - Whether the given position is relative or not.
	 * @returns {Number} - The normalized position.
	 */
	Owl.prototype.normalize = function(position, relative) {
		var n = this._items.length,
			m = relative ? 0 : this._clones.length;

		if (!this.isNumeric(position) || n < 1) {
			position = undefined;
		} else if (position < 0 || position >= n + m) {
			position = ((position - m / 2) % n + n) % n + m / 2;
		}

		return position;
	};

	/**
	 * Converts an absolute position of an item into a relative one.
	 * @public
	 * @param {Number} position - The absolute position to convert.
	 * @returns {Number} - The converted position.
	 */
	Owl.prototype.relative = function(position) {
		position -= this._clones.length / 2;
		return this.normalize(position, true);
	};

	/**
	 * Gets the maximum position for the current item.
	 * @public
	 * @param {Boolean} [relative=false] - Whether to return an absolute position or a relative position.
	 * @returns {Number}
	 */
	Owl.prototype.maximum = function(relative) {
		var settings = this.settings,
			maximum = this._coordinates.length,
			iterator,
			reciprocalItemsWidth,
			elementWidth;

		if (settings.loop) {
			maximum = this._clones.length / 2 + this._items.length - 1;
		} else if (settings.autoWidth || settings.merge) {
			iterator = this._items.length;
			if (iterator) {
				reciprocalItemsWidth = this._items[--iterator].width();
				elementWidth = this.$element.width();
				while (iterator--) {
					reciprocalItemsWidth += this._items[iterator].width() + this.settings.margin;
					if (reciprocalItemsWidth > elementWidth) {
						break;
					}
				}
			}
			maximum = iterator + 1;
		} else if (settings.center) {
			maximum = this._items.length - 1;
		} else {
			maximum = this._items.length - settings.items;
		}

		if (relative) {
			maximum -= this._clones.length / 2;
		}

		return Math.max(maximum, 0);
	};

	/**
	 * Gets the minimum position for the current item.
	 * @public
	 * @param {Boolean} [relative=false] - Whether to return an absolute position or a relative position.
	 * @returns {Number}
	 */
	Owl.prototype.minimum = function(relative) {
		return relative ? 0 : this._clones.length / 2;
	};

	/**
	 * Gets an item at the specified relative position.
	 * @public
	 * @param {Number} [position] - The relative position of the item.
	 * @return {jQuery|Array.<jQuery>} - The item at the given position or all items if no position was given.
	 */
	Owl.prototype.items = function(position) {
		if (position === undefined) {
			return this._items.slice();
		}

		position = this.normalize(position, true);
		return this._items[position];
	};

	/**
	 * Gets an item at the specified relative position.
	 * @public
	 * @param {Number} [position] - The relative position of the item.
	 * @return {jQuery|Array.<jQuery>} - The item at the given position or all items if no position was given.
	 */
	Owl.prototype.mergers = function(position) {
		if (position === undefined) {
			return this._mergers.slice();
		}

		position = this.normalize(position, true);
		return this._mergers[position];
	};

	/**
	 * Gets the absolute positions of clones for an item.
	 * @public
	 * @param {Number} [position] - The relative position of the item.
	 * @returns {Array.<Number>} - The absolute positions of clones for the item or all if no position was given.
	 */
	Owl.prototype.clones = function(position) {
		var odd = this._clones.length / 2,
			even = odd + this._items.length,
			map = function(index) { return index % 2 === 0 ? even + index / 2 : odd - (index + 1) / 2 };

		if (position === undefined) {
			return $.map(this._clones, function(v, i) { return map(i) });
		}

		return $.map(this._clones, function(v, i) { return v === position ? map(i) : null });
	};

	/**
	 * Sets the current animation speed.
	 * @public
	 * @param {Number} [speed] - The animation speed in milliseconds or nothing to leave it unchanged.
	 * @returns {Number} - The current animation speed in milliseconds.
	 */
	Owl.prototype.speed = function(speed) {
		if (speed !== undefined) {
			this._speed = speed;
		}

		return this._speed;
	};

	/**
	 * Gets the coordinate of an item.
	 * @todo The name of this method is missleanding.
	 * @public
	 * @param {Number} position - The absolute position of the item within `minimum()` and `maximum()`.
	 * @returns {Number|Array.<Number>} - The coordinate of the item in pixel or all coordinates.
	 */
	Owl.prototype.coordinates = function(position) {
		var multiplier = 1,
			newPosition = position - 1,
			coordinate;

		if (position === undefined) {
			return $.map(this._coordinates, $.proxy(function(coordinate, index) {
				return this.coordinates(index);
			}, this));
		}

		if (this.settings.center) {
			if (this.settings.rtl) {
				multiplier = -1;
				newPosition = position + 1;
			}

			coordinate = this._coordinates[position];
			coordinate += (this.width() - coordinate + (this._coordinates[newPosition] || 0)) / 2 * multiplier;
		} else {
			coordinate = this._coordinates[newPosition] || 0;
		}

		coordinate = Math.ceil(coordinate);

		return coordinate;
	};

	/**
	 * Calculates the speed for a translation.
	 * @protected
	 * @param {Number} from - The absolute position of the start item.
	 * @param {Number} to - The absolute position of the target item.
	 * @param {Number} [factor=undefined] - The time factor in milliseconds.
	 * @returns {Number} - The time in milliseconds for the translation.
	 */
	Owl.prototype.duration = function(from, to, factor) {
		if (factor === 0) {
			return 0;
		}

		return Math.min(Math.max(Math.abs(to - from), 1), 6) * Math.abs((factor || this.settings.smartSpeed));
	};

	/**
	 * Slides to the specified item.
	 * @public
	 * @param {Number} position - The position of the item.
	 * @param {Number} [speed] - The time in milliseconds for the transition.
	 */
	Owl.prototype.to = function(position, speed) {
		var current = this.current(),
			revert = null,
			distance = position - this.relative(current),
			direction = (distance > 0) - (distance < 0),
			items = this._items.length,
			minimum = this.minimum(),
			maximum = this.maximum();

		if (this.settings.loop) {
			if (!this.settings.rewind && Math.abs(distance) > items / 2) {
				distance += direction * -1 * items;
			}

			position = current + distance;
			revert = ((position - minimum) % items + items) % items + minimum;

			if (revert !== position && revert - distance <= maximum && revert - distance > 0) {
				current = revert - distance;
				position = revert;
				this.reset(current);
			}
		} else if (this.settings.rewind) {
			maximum += 1;
			position = (position % maximum + maximum) % maximum;
		} else {
			position = Math.max(minimum, Math.min(maximum, position));
		}

		this.speed(this.duration(current, position, speed));
		this.current(position);

		if (this.isVisible()) {
			this.update();
		}
	};

	/**
	 * Slides to the next item.
	 * @public
	 * @param {Number} [speed] - The time in milliseconds for the transition.
	 */
	Owl.prototype.next = function(speed) {
		speed = speed || false;
		this.to(this.relative(this.current()) + 1, speed);
	};

	/**
	 * Slides to the previous item.
	 * @public
	 * @param {Number} [speed] - The time in milliseconds for the transition.
	 */
	Owl.prototype.prev = function(speed) {
		speed = speed || false;
		this.to(this.relative(this.current()) - 1, speed);
	};

	/**
	 * Handles the end of an animation.
	 * @protected
	 * @param {Event} event - The event arguments.
	 */
	Owl.prototype.onTransitionEnd = function(event) {

		// if css2 animation then event object is undefined
		if (event !== undefined) {
			event.stopPropagation();

			// Catch only owl-stage transitionEnd event
			if ((event.target || event.srcElement || event.originalTarget) !== this.$stage.get(0)) {
				return false;
			}
		}

		this.leave('animating');
		this.trigger('translated');
	};

	/**
	 * Gets viewport width.
	 * @protected
	 * @return {Number} - The width in pixel.
	 */
	Owl.prototype.viewport = function() {
		var width;
		if (this.options.responsiveBaseElement !== window) {
			width = $(this.options.responsiveBaseElement).width();
		} else if (window.innerWidth) {
			width = window.innerWidth;
		} else if (document.documentElement && document.documentElement.clientWidth) {
			width = document.documentElement.clientWidth;
		} else {
			console.warn('Can not detect viewport width.');
		}
		return width;
	};

	/**
	 * Replaces the current content.
	 * @public
	 * @param {HTMLElement|jQuery|String} content - The new content.
	 */
	Owl.prototype.replace = function(content) {
		this.$stage.empty();
		this._items = [];

		if (content) {
			content = (content instanceof jQuery) ? content : $(content);
		}

		if (this.settings.nestedItemSelector) {
			content = content.find('.' + this.settings.nestedItemSelector);
		}

		content.filter(function() {
			return this.nodeType === 1;
		}).each($.proxy(function(index, item) {
			item = this.prepare(item);
			this.$stage.append(item);
			this._items.push(item);
			this._mergers.push(item.find('[data-merge]').addBack('[data-merge]').attr('data-merge') * 1 || 1);
		}, this));

		this.reset(this.isNumeric(this.settings.startPosition) ? this.settings.startPosition : 0);

		this.invalidate('items');
	};

	/**
	 * Adds an item.
	 * @todo Use `item` instead of `content` for the event arguments.
	 * @public
	 * @param {HTMLElement|jQuery|String} content - The item content to add.
	 * @param {Number} [position] - The relative position at which to insert the item otherwise the item will be added to the end.
	 */
	Owl.prototype.add = function(content, position) {
		var current = this.relative(this._current);

		position = position === undefined ? this._items.length : this.normalize(position, true);
		content = content instanceof jQuery ? content : $(content);

		this.trigger('add', { content: content, position: position });

		content = this.prepare(content);

		if (this._items.length === 0 || position === this._items.length) {
			this._items.length === 0 && this.$stage.append(content);
			this._items.length !== 0 && this._items[position - 1].after(content);
			this._items.push(content);
			this._mergers.push(content.find('[data-merge]').addBack('[data-merge]').attr('data-merge') * 1 || 1);
		} else {
			this._items[position].before(content);
			this._items.splice(position, 0, content);
			this._mergers.splice(position, 0, content.find('[data-merge]').addBack('[data-merge]').attr('data-merge') * 1 || 1);
		}

		this._items[current] && this.reset(this._items[current].index());

		this.invalidate('items');

		this.trigger('added', { content: content, position: position });
	};

	/**
	 * Removes an item by its position.
	 * @todo Use `item` instead of `content` for the event arguments.
	 * @public
	 * @param {Number} position - The relative position of the item to remove.
	 */
	Owl.prototype.remove = function(position) {
		position = this.normalize(position, true);

		if (position === undefined) {
			return;
		}

		this.trigger('remove', { content: this._items[position], position: position });

		this._items[position].remove();
		this._items.splice(position, 1);
		this._mergers.splice(position, 1);

		this.invalidate('items');

		this.trigger('removed', { content: null, position: position });
	};

	/**
	 * Preloads images with auto width.
	 * @todo Replace by a more generic approach
	 * @protected
	 */
	Owl.prototype.preloadAutoWidthImages = function(images) {
		images.each($.proxy(function(i, element) {
			this.enter('pre-loading');
			element = $(element);
			$(new Image()).one('load', $.proxy(function(e) {
				element.attr('src', e.target.src);
				element.css('opacity', 1);
				this.leave('pre-loading');
				!this.is('pre-loading') && !this.is('initializing') && this.refresh();
			}, this)).attr('src', element.attr('src') || element.attr('data-src') || element.attr('data-src-retina'));
		}, this));
	};

	/**
	 * Destroys the carousel.
	 * @public
	 */
	Owl.prototype.destroy = function() {

		this.$element.off('.owl.core');
		this.$stage.off('.owl.core');
		$(document).off('.owl.core');

		if (this.settings.responsive !== false) {
			window.clearTimeout(this.resizeTimer);
			this.off(window, 'resize', this._handlers.onThrottledResize);
		}

		for (var i in this._plugins) {
			this._plugins[i].destroy();
		}

		this.$stage.children('.cloned').remove();

		this.$stage.unwrap();
		this.$stage.children().contents().unwrap();
		this.$stage.children().unwrap();
		this.$stage.remove();
		this.$element
			.removeClass(this.options.refreshClass)
			.removeClass(this.options.loadingClass)
			.removeClass(this.options.loadedClass)
			.removeClass(this.options.rtlClass)
			.removeClass(this.options.dragClass)
			.removeClass(this.options.grabClass)
			.attr('class', this.$element.attr('class').replace(new RegExp(this.options.responsiveClass + '-\\S+\\s', 'g'), ''))
			.removeData('owl.carousel');
	};

	/**
	 * Operators to calculate right-to-left and left-to-right.
	 * @protected
	 * @param {Number} [a] - The left side operand.
	 * @param {String} [o] - The operator.
	 * @param {Number} [b] - The right side operand.
	 */
	Owl.prototype.op = function(a, o, b) {
		var rtl = this.settings.rtl;
		switch (o) {
			case '<':
				return rtl ? a > b : a < b;
			case '>':
				return rtl ? a < b : a > b;
			case '>=':
				return rtl ? a <= b : a >= b;
			case '<=':
				return rtl ? a >= b : a <= b;
			default:
				break;
		}
	};

	/**
	 * Attaches to an internal event.
	 * @protected
	 * @param {HTMLElement} element - The event source.
	 * @param {String} event - The event name.
	 * @param {Function} listener - The event handler to attach.
	 * @param {Boolean} capture - Wether the event should be handled at the capturing phase or not.
	 */
	Owl.prototype.on = function(element, event, listener, capture) {
		if (element.addEventListener) {
			element.addEventListener(event, listener, capture);
		} else if (element.attachEvent) {
			element.attachEvent('on' + event, listener);
		}
	};

	/**
	 * Detaches from an internal event.
	 * @protected
	 * @param {HTMLElement} element - The event source.
	 * @param {String} event - The event name.
	 * @param {Function} listener - The attached event handler to detach.
	 * @param {Boolean} capture - Wether the attached event handler was registered as a capturing listener or not.
	 */
	Owl.prototype.off = function(element, event, listener, capture) {
		if (element.removeEventListener) {
			element.removeEventListener(event, listener, capture);
		} else if (element.detachEvent) {
			element.detachEvent('on' + event, listener);
		}
	};

	/**
	 * Triggers a public event.
	 * @todo Remove `status`, `relatedTarget` should be used instead.
	 * @protected
	 * @param {String} name - The event name.
	 * @param {*} [data=null] - The event data.
	 * @param {String} [namespace=carousel] - The event namespace.
	 * @param {String} [state] - The state which is associated with the event.
	 * @param {Boolean} [enter=false] - Indicates if the call enters the specified state or not.
	 * @returns {Event} - The event arguments.
	 */
	Owl.prototype.trigger = function(name, data, namespace, state, enter) {
		var status = {
			item: { count: this._items.length, index: this.current() }
		}, handler = $.camelCase(
			$.grep([ 'on', name, namespace ], function(v) { return v })
				.join('-').toLowerCase()
		), event = $.Event(
			[ name, 'owl', namespace || 'carousel' ].join('.').toLowerCase(),
			$.extend({ relatedTarget: this }, status, data)
		);

		if (!this._supress[name]) {
			$.each(this._plugins, function(name, plugin) {
				if (plugin.onTrigger) {
					plugin.onTrigger(event);
				}
			});

			this.register({ type: Owl.Type.Event, name: name });
			this.$element.trigger(event);

			if (this.settings && typeof this.settings[handler] === 'function') {
				this.settings[handler].call(this, event);
			}
		}

		return event;
	};

	/**
	 * Enters a state.
	 * @param name - The state name.
	 */
	Owl.prototype.enter = function(name) {
		$.each([ name ].concat(this._states.tags[name] || []), $.proxy(function(i, name) {
			if (this._states.current[name] === undefined) {
				this._states.current[name] = 0;
			}

			this._states.current[name]++;
		}, this));
	};

	/**
	 * Leaves a state.
	 * @param name - The state name.
	 */
	Owl.prototype.leave = function(name) {
		$.each([ name ].concat(this._states.tags[name] || []), $.proxy(function(i, name) {
			this._states.current[name]--;
		}, this));
	};

	/**
	 * Registers an event or state.
	 * @public
	 * @param {Object} object - The event or state to register.
	 */
	Owl.prototype.register = function(object) {
		if (object.type === Owl.Type.Event) {
			if (!$.event.special[object.name]) {
				$.event.special[object.name] = {};
			}

			if (!$.event.special[object.name].owl) {
				var _default = $.event.special[object.name]._default;
				$.event.special[object.name]._default = function(e) {
					if (_default && _default.apply && (!e.namespace || e.namespace.indexOf('owl') === -1)) {
						return _default.apply(this, arguments);
					}
					return e.namespace && e.namespace.indexOf('owl') > -1;
				};
				$.event.special[object.name].owl = true;
			}
		} else if (object.type === Owl.Type.State) {
			if (!this._states.tags[object.name]) {
				this._states.tags[object.name] = object.tags;
			} else {
				this._states.tags[object.name] = this._states.tags[object.name].concat(object.tags);
			}

			this._states.tags[object.name] = $.grep(this._states.tags[object.name], $.proxy(function(tag, i) {
				return $.inArray(tag, this._states.tags[object.name]) === i;
			}, this));
		}
	};

	/**
	 * Suppresses events.
	 * @protected
	 * @param {Array.<String>} events - The events to suppress.
	 */
	Owl.prototype.suppress = function(events) {
		$.each(events, $.proxy(function(index, event) {
			this._supress[event] = true;
		}, this));
	};

	/**
	 * Releases suppressed events.
	 * @protected
	 * @param {Array.<String>} events - The events to release.
	 */
	Owl.prototype.release = function(events) {
		$.each(events, $.proxy(function(index, event) {
			delete this._supress[event];
		}, this));
	};

	/**
	 * Gets unified pointer coordinates from event.
	 * @todo #261
	 * @protected
	 * @param {Event} - The `mousedown` or `touchstart` event.
	 * @returns {Object} - Contains `x` and `y` coordinates of current pointer position.
	 */
	Owl.prototype.pointer = function(event) {
		var result = { x: null, y: null };

		event = event.originalEvent || event || window.event;

		event = event.touches && event.touches.length ?
			event.touches[0] : event.changedTouches && event.changedTouches.length ?
				event.changedTouches[0] : event;

		if (event.pageX) {
			result.x = event.pageX;
			result.y = event.pageY;
		} else {
			result.x = event.clientX;
			result.y = event.clientY;
		}

		return result;
	};

	/**
	 * Determines if the input is a Number or something that can be coerced to a Number
	 * @protected
	 * @param {Number|String|Object|Array|Boolean|RegExp|Function|Symbol} - The input to be tested
	 * @returns {Boolean} - An indication if the input is a Number or can be coerced to a Number
	 */
	Owl.prototype.isNumeric = function(number) {
		return !isNaN(parseFloat(number));
	};

	/**
	 * Gets the difference of two vectors.
	 * @todo #261
	 * @protected
	 * @param {Object} - The first vector.
	 * @param {Object} - The second vector.
	 * @returns {Object} - The difference.
	 */
	Owl.prototype.difference = function(first, second) {
		return {
			x: first.x - second.x,
			y: first.y - second.y
		};
	};

	/**
	 * The jQuery Plugin for the Owl Carousel
	 * @todo Navigation plugin `next` and `prev`
	 * @public
	 */
	$.fn.owlCarousel = function(option) {
		var args = Array.prototype.slice.call(arguments, 1);

		return this.each(function() {
			var $this = $(this),
				data = $this.data('owl.carousel');

			if (!data) {
				data = new Owl(this, typeof option == 'object' && option);
				$this.data('owl.carousel', data);

				$.each([
					'next', 'prev', 'to', 'destroy', 'refresh', 'replace', 'add', 'remove'
				], function(i, event) {
					data.register({ type: Owl.Type.Event, name: event });
					data.$element.on(event + '.owl.carousel.core', $.proxy(function(e) {
						if (e.namespace && e.relatedTarget !== this) {
							this.suppress([ event ]);
							data[event].apply(this, [].slice.call(arguments, 1));
							this.release([ event ]);
						}
					}, data));
				});
			}

			if (typeof option == 'string' && option.charAt(0) !== '_') {
				data[option].apply(data, args);
			}
		});
	};

	/**
	 * The constructor for the jQuery Plugin
	 * @public
	 */
	$.fn.owlCarousel.Constructor = Owl;

})(window.Zepto || window.jQuery, window, document);

/**
 * AutoRefresh Plugin
 * @version 2.3.4
 * @author Artus Kolanowski
 * @author David Deutsch
 * @license The MIT License (MIT)
 */
;(function($, window, document, undefined) {

	/**
	 * Creates the auto refresh plugin.
	 * @class The Auto Refresh Plugin
	 * @param {Owl} carousel - The Owl Carousel
	 */
	var AutoRefresh = function(carousel) {
		/**
		 * Reference to the core.
		 * @protected
		 * @type {Owl}
		 */
		this._core = carousel;

		/**
		 * Refresh interval.
		 * @protected
		 * @type {number}
		 */
		this._interval = null;

		/**
		 * Whether the element is currently visible or not.
		 * @protected
		 * @type {Boolean}
		 */
		this._visible = null;

		/**
		 * All event handlers.
		 * @protected
		 * @type {Object}
		 */
		this._handlers = {
			'initialized.owl.carousel': $.proxy(function(e) {
				if (e.namespace && this._core.settings.autoRefresh) {
					this.watch();
				}
			}, this)
		};

		// set default options
		this._core.options = $.extend({}, AutoRefresh.Defaults, this._core.options);

		// register event handlers
		this._core.$element.on(this._handlers);
	};

	/**
	 * Default options.
	 * @public
	 */
	AutoRefresh.Defaults = {
		autoRefresh: true,
		autoRefreshInterval: 500
	};

	/**
	 * Watches the element.
	 */
	AutoRefresh.prototype.watch = function() {
		if (this._interval) {
			return;
		}

		this._visible = this._core.isVisible();
		this._interval = window.setInterval($.proxy(this.refresh, this), this._core.settings.autoRefreshInterval);
	};

	/**
	 * Refreshes the element.
	 */
	AutoRefresh.prototype.refresh = function() {
		if (this._core.isVisible() === this._visible) {
			return;
		}

		this._visible = !this._visible;

		this._core.$element.toggleClass('owl-hidden', !this._visible);

		this._visible && (this._core.invalidate('width') && this._core.refresh());
	};

	/**
	 * Destroys the plugin.
	 */
	AutoRefresh.prototype.destroy = function() {
		var handler, property;

		window.clearInterval(this._interval);

		for (handler in this._handlers) {
			this._core.$element.off(handler, this._handlers[handler]);
		}
		for (property in Object.getOwnPropertyNames(this)) {
			typeof this[property] != 'function' && (this[property] = null);
		}
	};

	$.fn.owlCarousel.Constructor.Plugins.AutoRefresh = AutoRefresh;

})(window.Zepto || window.jQuery, window, document);

/**
 * Lazy Plugin
 * @version 2.3.4
 * @author Bartosz Wojciechowski
 * @author David Deutsch
 * @license The MIT License (MIT)
 */
;(function($, window, document, undefined) {

	/**
	 * Creates the lazy plugin.
	 * @class The Lazy Plugin
	 * @param {Owl} carousel - The Owl Carousel
	 */
	var Lazy = function(carousel) {

		/**
		 * Reference to the core.
		 * @protected
		 * @type {Owl}
		 */
		this._core = carousel;

		/**
		 * Already loaded items.
		 * @protected
		 * @type {Array.<jQuery>}
		 */
		this._loaded = [];

		/**
		 * Event handlers.
		 * @protected
		 * @type {Object}
		 */
		this._handlers = {
			'initialized.owl.carousel change.owl.carousel resized.owl.carousel': $.proxy(function(e) {
				if (!e.namespace) {
					return;
				}

				if (!this._core.settings || !this._core.settings.lazyLoad) {
					return;
				}

				if ((e.property && e.property.name == 'position') || e.type == 'initialized') {
					var settings = this._core.settings,
						n = (settings.center && Math.ceil(settings.items / 2) || settings.items),
						i = ((settings.center && n * -1) || 0),
						position = (e.property && e.property.value !== undefined ? e.property.value : this._core.current()) + i,
						clones = this._core.clones().length,
						load = $.proxy(function(i, v) { this.load(v) }, this);
					//TODO: Need documentation for this new option
					if (settings.lazyLoadEager > 0) {
						n += settings.lazyLoadEager;
						// If the carousel is looping also preload images that are to the "left"
						if (settings.loop) {
              position -= settings.lazyLoadEager;
              n++;
            }
					}

					while (i++ < n) {
						this.load(clones / 2 + this._core.relative(position));
						clones && $.each(this._core.clones(this._core.relative(position)), load);
						position++;
					}
				}
			}, this)
		};

		// set the default options
		this._core.options = $.extend({}, Lazy.Defaults, this._core.options);

		// register event handler
		this._core.$element.on(this._handlers);
	};

	/**
	 * Default options.
	 * @public
	 */
	Lazy.Defaults = {
		lazyLoad: false,
		lazyLoadEager: 0
	};

	/**
	 * Loads all resources of an item at the specified position.
	 * @param {Number} position - The absolute position of the item.
	 * @protected
	 */
	Lazy.prototype.load = function(position) {
		var $item = this._core.$stage.children().eq(position),
			$elements = $item && $item.find('.owl-lazy');

		if (!$elements || $.inArray($item.get(0), this._loaded) > -1) {
			return;
		}

		$elements.each($.proxy(function(index, element) {
			var $element = $(element), image,
                url = (window.devicePixelRatio > 1 && $element.attr('data-src-retina')) || $element.attr('data-src') || $element.attr('data-srcset');

			this._core.trigger('load', { element: $element, url: url }, 'lazy');

			if ($element.is('img')) {
				$element.one('load.owl.lazy', $.proxy(function() {
					$element.css('opacity', 1);
					this._core.trigger('loaded', { element: $element, url: url }, 'lazy');
				}, this)).attr('src', url);
            } else if ($element.is('source')) {
                $element.one('load.owl.lazy', $.proxy(function() {
                    this._core.trigger('loaded', { element: $element, url: url }, 'lazy');
                }, this)).attr('srcset', url);
			} else {
				image = new Image();
				image.onload = $.proxy(function() {
					$element.css({
						'background-image': 'url("' + url + '")',
						'opacity': '1'
					});
					this._core.trigger('loaded', { element: $element, url: url }, 'lazy');
				}, this);
				image.src = url;
			}
		}, this));

		this._loaded.push($item.get(0));
	};

	/**
	 * Destroys the plugin.
	 * @public
	 */
	Lazy.prototype.destroy = function() {
		var handler, property;

		for (handler in this.handlers) {
			this._core.$element.off(handler, this.handlers[handler]);
		}
		for (property in Object.getOwnPropertyNames(this)) {
			typeof this[property] != 'function' && (this[property] = null);
		}
	};

	$.fn.owlCarousel.Constructor.Plugins.Lazy = Lazy;

})(window.Zepto || window.jQuery, window, document);

/**
 * AutoHeight Plugin
 * @version 2.3.4
 * @author Bartosz Wojciechowski
 * @author David Deutsch
 * @license The MIT License (MIT)
 */
;(function($, window, document, undefined) {

	/**
	 * Creates the auto height plugin.
	 * @class The Auto Height Plugin
	 * @param {Owl} carousel - The Owl Carousel
	 */
	var AutoHeight = function(carousel) {
		/**
		 * Reference to the core.
		 * @protected
		 * @type {Owl}
		 */
		this._core = carousel;

		this._previousHeight = null;

		/**
		 * All event handlers.
		 * @protected
		 * @type {Object}
		 */
		this._handlers = {
			'initialized.owl.carousel refreshed.owl.carousel': $.proxy(function(e) {
				if (e.namespace && this._core.settings.autoHeight) {
					this.update();
				}
			}, this),
			'changed.owl.carousel': $.proxy(function(e) {
				if (e.namespace && this._core.settings.autoHeight && e.property.name === 'position'){
					this.update();
				}
			}, this),
			'loaded.owl.lazy': $.proxy(function(e) {
				if (e.namespace && this._core.settings.autoHeight
					&& e.element.closest('.' + this._core.settings.itemClass).index() === this._core.current()) {
					this.update();
				}
			}, this)
		};

		// set default options
		this._core.options = $.extend({}, AutoHeight.Defaults, this._core.options);

		// register event handlers
		this._core.$element.on(this._handlers);
		this._intervalId = null;
		var refThis = this;

		// These changes have been taken from a PR by gavrochelegnou proposed in #1575
		// and have been made compatible with the latest jQuery version
		$(window).on('load', function() {
			if (refThis._core.settings.autoHeight) {
				refThis.update();
			}
		});

		// Autoresize the height of the carousel when window is resized
		// When carousel has images, the height is dependent on the width
		// and should also change on resize
		$(window).resize(function() {
			if (refThis._core.settings.autoHeight) {
				if (refThis._intervalId != null) {
					clearTimeout(refThis._intervalId);
				}

				refThis._intervalId = setTimeout(function() {
					refThis.update();
				}, 250);
			}
		});

	};

	/**
	 * Default options.
	 * @public
	 */
	AutoHeight.Defaults = {
		autoHeight: false,
		autoHeightClass: 'owl-height'
	};

	/**
	 * Updates the view.
	 */
	AutoHeight.prototype.update = function() {
		var start = this._core._current,
			end = start + this._core.settings.items,
			lazyLoadEnabled = this._core.settings.lazyLoad,
			visible = this._core.$stage.children().toArray().slice(start, end),
			heights = [],
			maxheight = 0;

		$.each(visible, function(index, item) {
			heights.push($(item).height());
		});

		maxheight = Math.max.apply(null, heights);

		if (maxheight <= 1 && lazyLoadEnabled && this._previousHeight) {
			maxheight = this._previousHeight;
		}

		this._previousHeight = maxheight;

		this._core.$stage.parent()
			.height(maxheight)
			.addClass(this._core.settings.autoHeightClass);
	};

	AutoHeight.prototype.destroy = function() {
		var handler, property;

		for (handler in this._handlers) {
			this._core.$element.off(handler, this._handlers[handler]);
		}
		for (property in Object.getOwnPropertyNames(this)) {
			typeof this[property] !== 'function' && (this[property] = null);
		}
	};

	$.fn.owlCarousel.Constructor.Plugins.AutoHeight = AutoHeight;

})(window.Zepto || window.jQuery, window, document);

/**
 * Video Plugin
 * @version 2.3.4
 * @author Bartosz Wojciechowski
 * @author David Deutsch
 * @license The MIT License (MIT)
 */
;(function($, window, document, undefined) {

	/**
	 * Creates the video plugin.
	 * @class The Video Plugin
	 * @param {Owl} carousel - The Owl Carousel
	 */
	var Video = function(carousel) {
		/**
		 * Reference to the core.
		 * @protected
		 * @type {Owl}
		 */
		this._core = carousel;

		/**
		 * Cache all video URLs.
		 * @protected
		 * @type {Object}
		 */
		this._videos = {};

		/**
		 * Current playing item.
		 * @protected
		 * @type {jQuery}
		 */
		this._playing = null;

		/**
		 * All event handlers.
		 * @todo The cloned content removale is too late
		 * @protected
		 * @type {Object}
		 */
		this._handlers = {
			'initialized.owl.carousel': $.proxy(function(e) {
				if (e.namespace) {
					this._core.register({ type: 'state', name: 'playing', tags: [ 'interacting' ] });
				}
			}, this),
			'resize.owl.carousel': $.proxy(function(e) {
				if (e.namespace && this._core.settings.video && this.isInFullScreen()) {
					e.preventDefault();
				}
			}, this),
			'refreshed.owl.carousel': $.proxy(function(e) {
				if (e.namespace && this._core.is('resizing')) {
					this._core.$stage.find('.cloned .owl-video-frame').remove();
				}
			}, this),
			'changed.owl.carousel': $.proxy(function(e) {
				if (e.namespace && e.property.name === 'position' && this._playing) {
					this.stop();
				}
			}, this),
			'prepared.owl.carousel': $.proxy(function(e) {
				if (!e.namespace) {
					return;
				}

				var $element = $(e.content).find('.owl-video');

				if ($element.length) {
					$element.css('display', 'none');
					this.fetch($element, $(e.content));
				}
			}, this)
		};

		// set default options
		this._core.options = $.extend({}, Video.Defaults, this._core.options);

		// register event handlers
		this._core.$element.on(this._handlers);

		this._core.$element.on('click.owl.video', '.owl-video-play-icon', $.proxy(function(e) {
			this.play(e);
		}, this));
	};

	/**
	 * Default options.
	 * @public
	 */
	Video.Defaults = {
		video: false,
		videoHeight: false,
		videoWidth: false
	};

	/**
	 * Gets the video ID and the type (YouTube/Vimeo/vzaar only).
	 * @protected
	 * @param {jQuery} target - The target containing the video data.
	 * @param {jQuery} item - The item containing the video.
	 */
	Video.prototype.fetch = function(target, item) {
			var type = (function() {
					if (target.attr('data-vimeo-id')) {
						return 'vimeo';
					} else if (target.attr('data-vzaar-id')) {
						return 'vzaar'
					} else {
						return 'youtube';
					}
				})(),
				id = target.attr('data-vimeo-id') || target.attr('data-youtube-id') || target.attr('data-vzaar-id'),
				width = target.attr('data-width') || this._core.settings.videoWidth,
				height = target.attr('data-height') || this._core.settings.videoHeight,
				url = target.attr('href');

		if (url) {

			/*
					Parses the id's out of the following urls (and probably more):
					https://www.youtube.com/watch?v=:id
					https://youtu.be/:id
					https://vimeo.com/:id
					https://vimeo.com/channels/:channel/:id
					https://vimeo.com/groups/:group/videos/:id
					https://app.vzaar.com/videos/:id

					Visual example: https://regexper.com/#(http%3A%7Chttps%3A%7C)%5C%2F%5C%2F(player.%7Cwww.%7Capp.)%3F(vimeo%5C.com%7Cyoutu(be%5C.com%7C%5C.be%7Cbe%5C.googleapis%5C.com)%7Cvzaar%5C.com)%5C%2F(video%5C%2F%7Cvideos%5C%2F%7Cembed%5C%2F%7Cchannels%5C%2F.%2B%5C%2F%7Cgroups%5C%2F.%2B%5C%2F%7Cwatch%5C%3Fv%3D%7Cv%5C%2F)%3F(%5BA-Za-z0-9._%25-%5D*)(%5C%26%5CS%2B)%3F
			*/

			id = url.match(/(http:|https:|)\/\/(player.|www.|app.)?(vimeo\.com|youtu(be\.com|\.be|be\.googleapis\.com|be\-nocookie\.com)|vzaar\.com)\/(video\/|videos\/|embed\/|channels\/.+\/|groups\/.+\/|watch\?v=|v\/)?([A-Za-z0-9._%-]*)(\&\S+)?/);

			if (id[3].indexOf('youtu') > -1) {
				type = 'youtube';
			} else if (id[3].indexOf('vimeo') > -1) {
				type = 'vimeo';
			} else if (id[3].indexOf('vzaar') > -1) {
				type = 'vzaar';
			} else {
				throw new Error('Video URL not supported.');
			}
			id = id[6];
		} else {
			throw new Error('Missing video URL.');
		}

		this._videos[url] = {
			type: type,
			id: id,
			width: width,
			height: height
		};

		item.attr('data-video', url);

		this.thumbnail(target, this._videos[url]);
	};

	/**
	 * Creates video thumbnail.
	 * @protected
	 * @param {jQuery} target - The target containing the video data.
	 * @param {Object} info - The video info object.
	 * @see `fetch`
	 */
	Video.prototype.thumbnail = function(target, video) {
		var tnLink,
			icon,
			path,
			dimensions = video.width && video.height ? 'width:' + video.width + 'px;height:' + video.height + 'px;' : '',
			customTn = target.find('img'),
			srcType = 'src',
			lazyClass = '',
			settings = this._core.settings,
			create = function(path) {
				icon = '<div class="owl-video-play-icon"></div>';

				if (settings.lazyLoad) {
					tnLink = $('<div/>',{
						"class": 'owl-video-tn ' + lazyClass,
						"srcType": path
					});
				} else {
					tnLink = $( '<div/>', {
						"class": "owl-video-tn",
						"style": 'opacity:1;background-image:url(' + path + ')'
					});
				}
				target.after(tnLink);
				target.after(icon);
			};

		// wrap video content into owl-video-wrapper div
		target.wrap( $( '<div/>', {
			"class": "owl-video-wrapper",
			"style": dimensions
		}));

		if (this._core.settings.lazyLoad) {
			srcType = 'data-src';
			lazyClass = 'owl-lazy';
		}

		// custom thumbnail
		if (customTn.length) {
			create(customTn.attr(srcType));
			customTn.remove();
			return false;
		}

		if (video.type === 'youtube') {
			path = "//img.youtube.com/vi/" + video.id + "/hqdefault.jpg";
			create(path);
		} else if (video.type === 'vimeo') {
			$.ajax({
				type: 'GET',
				url: '//vimeo.com/api/v2/video/' + video.id + '.json',
				jsonp: 'callback',
				dataType: 'jsonp',
				success: function(data) {
					path = data[0].thumbnail_large;
					create(path);
				}
			});
		} else if (video.type === 'vzaar') {
			$.ajax({
				type: 'GET',
				url: '//vzaar.com/api/videos/' + video.id + '.json',
				jsonp: 'callback',
				dataType: 'jsonp',
				success: function(data) {
					path = data.framegrab_url;
					create(path);
				}
			});
		}
	};

	/**
	 * Stops the current video.
	 * @public
	 */
	Video.prototype.stop = function() {
		this._core.trigger('stop', null, 'video');
		this._playing.find('.owl-video-frame').remove();
		this._playing.removeClass('owl-video-playing');
		this._playing = null;
		this._core.leave('playing');
		this._core.trigger('stopped', null, 'video');
	};

	/**
	 * Starts the current video.
	 * @public
	 * @param {Event} event - The event arguments.
	 */
	Video.prototype.play = function(event) {
		var target = $(event.target),
			item = target.closest('.' + this._core.settings.itemClass),
			video = this._videos[item.attr('data-video')],
			width = video.width || '100%',
			height = video.height || this._core.$stage.height(),
			html,
			iframe;

		if (this._playing) {
			return;
		}

		this._core.enter('playing');
		this._core.trigger('play', null, 'video');

		item = this._core.items(this._core.relative(item.index()));

		this._core.reset(item.index());

		html = $( '<iframe frameborder="0" allowfullscreen mozallowfullscreen webkitAllowFullScreen ></iframe>' );
		html.attr( 'height', height );
		html.attr( 'width', width );
		if (video.type === 'youtube') {
			html.attr( 'src', '//www.youtube.com/embed/' + video.id + '?autoplay=1&rel=0&v=' + video.id );
		} else if (video.type === 'vimeo') {
			html.attr( 'src', '//player.vimeo.com/video/' + video.id + '?autoplay=1' );
		} else if (video.type === 'vzaar') {
			html.attr( 'src', '//view.vzaar.com/' + video.id + '/player?autoplay=true' );
		}

		iframe = $(html).wrap( '<div class="owl-video-frame" />' ).insertAfter(item.find('.owl-video'));

		this._playing = item.addClass('owl-video-playing');
	};

	/**
	 * Checks whether an video is currently in full screen mode or not.
	 * @todo Bad style because looks like a readonly method but changes members.
	 * @protected
	 * @returns {Boolean}
	 */
	Video.prototype.isInFullScreen = function() {
		var element = document.fullscreenElement || document.mozFullScreenElement ||
				document.webkitFullscreenElement;

		return element && $(element).parent().hasClass('owl-video-frame');
	};

	/**
	 * Destroys the plugin.
	 */
	Video.prototype.destroy = function() {
		var handler, property;

		this._core.$element.off('click.owl.video');

		for (handler in this._handlers) {
			this._core.$element.off(handler, this._handlers[handler]);
		}
		for (property in Object.getOwnPropertyNames(this)) {
			typeof this[property] != 'function' && (this[property] = null);
		}
	};

	$.fn.owlCarousel.Constructor.Plugins.Video = Video;

})(window.Zepto || window.jQuery, window, document);

/**
 * Animate Plugin
 * @version 2.3.4
 * @author Bartosz Wojciechowski
 * @author David Deutsch
 * @license The MIT License (MIT)
 */
;(function($, window, document, undefined) {

	/**
	 * Creates the animate plugin.
	 * @class The Navigation Plugin
	 * @param {Owl} scope - The Owl Carousel
	 */
	var Animate = function(scope) {
		this.core = scope;
		this.core.options = $.extend({}, Animate.Defaults, this.core.options);
		this.swapping = true;
		this.previous = undefined;
		this.next = undefined;

		this.handlers = {
			'change.owl.carousel': $.proxy(function(e) {
				if (e.namespace && e.property.name == 'position') {
					this.previous = this.core.current();
					this.next = e.property.value;
				}
			}, this),
			'drag.owl.carousel dragged.owl.carousel translated.owl.carousel': $.proxy(function(e) {
				if (e.namespace) {
					this.swapping = e.type == 'translated';
				}
			}, this),
			'translate.owl.carousel': $.proxy(function(e) {
				if (e.namespace && this.swapping && (this.core.options.animateOut || this.core.options.animateIn)) {
					this.swap();
				}
			}, this)
		};

		this.core.$element.on(this.handlers);
	};

	/**
	 * Default options.
	 * @public
	 */
	Animate.Defaults = {
		animateOut: false,
		animateIn: false
	};

	/**
	 * Toggles the animation classes whenever an translations starts.
	 * @protected
	 * @returns {Boolean|undefined}
	 */
	Animate.prototype.swap = function() {

		if (this.core.settings.items !== 1) {
			return;
		}

		if (!$.support.animation || !$.support.transition) {
			return;
		}

		this.core.speed(0);

		var left,
			clear = $.proxy(this.clear, this),
			previous = this.core.$stage.children().eq(this.previous),
			next = this.core.$stage.children().eq(this.next),
			incoming = this.core.settings.animateIn,
			outgoing = this.core.settings.animateOut;

		if (this.core.current() === this.previous) {
			return;
		}

		if (outgoing) {
			left = this.core.coordinates(this.previous) - this.core.coordinates(this.next);
			previous.one($.support.animation.end, clear)
				.css( { 'left': left + 'px' } )
				.addClass('animated owl-animated-out')
				.addClass(outgoing);
		}

		if (incoming) {
			next.one($.support.animation.end, clear)
				.addClass('animated owl-animated-in')
				.addClass(incoming);
		}
	};

	Animate.prototype.clear = function(e) {
		$(e.target).css( { 'left': '' } )
			.removeClass('animated owl-animated-out owl-animated-in')
			.removeClass(this.core.settings.animateIn)
			.removeClass(this.core.settings.animateOut);
		this.core.onTransitionEnd();
	};

	/**
	 * Destroys the plugin.
	 * @public
	 */
	Animate.prototype.destroy = function() {
		var handler, property;

		for (handler in this.handlers) {
			this.core.$element.off(handler, this.handlers[handler]);
		}
		for (property in Object.getOwnPropertyNames(this)) {
			typeof this[property] != 'function' && (this[property] = null);
		}
	};

	$.fn.owlCarousel.Constructor.Plugins.Animate = Animate;

})(window.Zepto || window.jQuery, window, document);

/**
 * Autoplay Plugin
 * @version 2.3.4
 * @author Bartosz Wojciechowski
 * @author Artus Kolanowski
 * @author David Deutsch
 * @author Tom De Caluwé
 * @license The MIT License (MIT)
 */
;(function($, window, document, undefined) {

	/**
	 * Creates the autoplay plugin.
	 * @class The Autoplay Plugin
	 * @param {Owl} scope - The Owl Carousel
	 */
	var Autoplay = function(carousel) {
		/**
		 * Reference to the core.
		 * @protected
		 * @type {Owl}
		 */
		this._core = carousel;

		/**
		 * The autoplay timeout id.
		 * @type {Number}
		 */
		this._call = null;

		/**
		 * Depending on the state of the plugin, this variable contains either
		 * the start time of the timer or the current timer value if it's
		 * paused. Since we start in a paused state we initialize the timer
		 * value.
		 * @type {Number}
		 */
		this._time = 0;

		/**
		 * Stores the timeout currently used.
		 * @type {Number}
		 */
		this._timeout = 0;

		/**
		 * Indicates whenever the autoplay is paused.
		 * @type {Boolean}
		 */
		this._paused = true;

		/**
		 * All event handlers.
		 * @protected
		 * @type {Object}
		 */
		this._handlers = {
			'changed.owl.carousel': $.proxy(function(e) {
				if (e.namespace && e.property.name === 'settings') {
					if (this._core.settings.autoplay) {
						this.play();
					} else {
						this.stop();
					}
				} else if (e.namespace && e.property.name === 'position' && this._paused) {
					// Reset the timer. This code is triggered when the position
					// of the carousel was changed through user interaction.
					this._time = 0;
				}
			}, this),
			'initialized.owl.carousel': $.proxy(function(e) {
				if (e.namespace && this._core.settings.autoplay) {
					this.play();
				}
			}, this),
			'play.owl.autoplay': $.proxy(function(e, t, s) {
				if (e.namespace) {
					this.play(t, s);
				}
			}, this),
			'stop.owl.autoplay': $.proxy(function(e) {
				if (e.namespace) {
					this.stop();
				}
			}, this),
			'mouseover.owl.autoplay': $.proxy(function() {
				if (this._core.settings.autoplayHoverPause && this._core.is('rotating')) {
					this.pause();
				}
			}, this),
			'mouseleave.owl.autoplay': $.proxy(function() {
				if (this._core.settings.autoplayHoverPause && this._core.is('rotating')) {
					this.play();
				}
			}, this),
			'touchstart.owl.core': $.proxy(function() {
				if (this._core.settings.autoplayHoverPause && this._core.is('rotating')) {
					this.pause();
				}
			}, this),
			'touchend.owl.core': $.proxy(function() {
				if (this._core.settings.autoplayHoverPause) {
					this.play();
				}
			}, this)
		};

		// register event handlers
		this._core.$element.on(this._handlers);

		// set default options
		this._core.options = $.extend({}, Autoplay.Defaults, this._core.options);
	};

	/**
	 * Default options.
	 * @public
	 */
	Autoplay.Defaults = {
		autoplay: false,
		autoplayTimeout: 5000,
		autoplayHoverPause: false,
		autoplaySpeed: false
	};

	/**
	 * Transition to the next slide and set a timeout for the next transition.
	 * @private
	 * @param {Number} [speed] - The animation speed for the animations.
	 */
	Autoplay.prototype._next = function(speed) {
		this._call = window.setTimeout(
			$.proxy(this._next, this, speed),
			this._timeout * (Math.round(this.read() / this._timeout) + 1) - this.read()
		);

		if (this._core.is('interacting') || document.hidden) {
			return;
		}
		this._core.next(speed || this._core.settings.autoplaySpeed);
	}

	/**
	 * Reads the current timer value when the timer is playing.
	 * @public
	 */
	Autoplay.prototype.read = function() {
		return new Date().getTime() - this._time;
	};

	/**
	 * Starts the autoplay.
	 * @public
	 * @param {Number} [timeout] - The interval before the next animation starts.
	 * @param {Number} [speed] - The animation speed for the animations.
	 */
	Autoplay.prototype.play = function(timeout, speed) {
		var elapsed;

		if (!this._core.is('rotating')) {
			this._core.enter('rotating');
		}

		timeout = timeout || this._core.settings.autoplayTimeout;

		// Calculate the elapsed time since the last transition. If the carousel
		// wasn't playing this calculation will yield zero.
		elapsed = Math.min(this._time % (this._timeout || timeout), timeout);

		if (this._paused) {
			// Start the clock.
			this._time = this.read();
			this._paused = false;
		} else {
			// Clear the active timeout to allow replacement.
			window.clearTimeout(this._call);
		}

		// Adjust the origin of the timer to match the new timeout value.
		this._time += this.read() % timeout - elapsed;

		this._timeout = timeout;
		this._call = window.setTimeout($.proxy(this._next, this, speed), timeout - elapsed);
	};

	/**
	 * Stops the autoplay.
	 * @public
	 */
	Autoplay.prototype.stop = function() {
		if (this._core.is('rotating')) {
			// Reset the clock.
			this._time = 0;
			this._paused = true;

			window.clearTimeout(this._call);
			this._core.leave('rotating');
		}
	};

	/**
	 * Pauses the autoplay.
	 * @public
	 */
	Autoplay.prototype.pause = function() {
		if (this._core.is('rotating') && !this._paused) {
			// Pause the clock.
			this._time = this.read();
			this._paused = true;

			window.clearTimeout(this._call);
		}
	};

	/**
	 * Destroys the plugin.
	 */
	Autoplay.prototype.destroy = function() {
		var handler, property;

		this.stop();

		for (handler in this._handlers) {
			this._core.$element.off(handler, this._handlers[handler]);
		}
		for (property in Object.getOwnPropertyNames(this)) {
			typeof this[property] != 'function' && (this[property] = null);
		}
	};

	$.fn.owlCarousel.Constructor.Plugins.autoplay = Autoplay;

})(window.Zepto || window.jQuery, window, document);

/**
 * Navigation Plugin
 * @version 2.3.4
 * @author Artus Kolanowski
 * @author David Deutsch
 * @license The MIT License (MIT)
 */
;(function($, window, document, undefined) {
	'use strict';

	/**
	 * Creates the navigation plugin.
	 * @class The Navigation Plugin
	 * @param {Owl} carousel - The Owl Carousel.
	 */
	var Navigation = function(carousel) {
		/**
		 * Reference to the core.
		 * @protected
		 * @type {Owl}
		 */
		this._core = carousel;

		/**
		 * Indicates whether the plugin is initialized or not.
		 * @protected
		 * @type {Boolean}
		 */
		this._initialized = false;

		/**
		 * The current paging indexes.
		 * @protected
		 * @type {Array}
		 */
		this._pages = [];

		/**
		 * All DOM elements of the user interface.
		 * @protected
		 * @type {Object}
		 */
		this._controls = {};

		/**
		 * Markup for an indicator.
		 * @protected
		 * @type {Array.<String>}
		 */
		this._templates = [];

		/**
		 * The carousel element.
		 * @type {jQuery}
		 */
		this.$element = this._core.$element;

		/**
		 * Overridden methods of the carousel.
		 * @protected
		 * @type {Object}
		 */
		this._overrides = {
			next: this._core.next,
			prev: this._core.prev,
			to: this._core.to
		};

		/**
		 * All event handlers.
		 * @protected
		 * @type {Object}
		 */
		this._handlers = {
			'prepared.owl.carousel': $.proxy(function(e) {
				if (e.namespace && this._core.settings.dotsData) {
					this._templates.push('<div class="' + this._core.settings.dotClass + '">' +
						$(e.content).find('[data-dot]').addBack('[data-dot]').attr('data-dot') + '</div>');
				}
			}, this),
			'added.owl.carousel': $.proxy(function(e) {
				if (e.namespace && this._core.settings.dotsData) {
					this._templates.splice(e.position, 0, this._templates.pop());
				}
			}, this),
			'remove.owl.carousel': $.proxy(function(e) {
				if (e.namespace && this._core.settings.dotsData) {
					this._templates.splice(e.position, 1);
				}
			}, this),
			'changed.owl.carousel': $.proxy(function(e) {
				if (e.namespace && e.property.name == 'position') {
					this.draw();
				}
			}, this),
			'initialized.owl.carousel': $.proxy(function(e) {
				if (e.namespace && !this._initialized) {
					this._core.trigger('initialize', null, 'navigation');
					this.initialize();
					this.update();
					this.draw();
					this._initialized = true;
					this._core.trigger('initialized', null, 'navigation');
				}
			}, this),
			'refreshed.owl.carousel': $.proxy(function(e) {
				if (e.namespace && this._initialized) {
					this._core.trigger('refresh', null, 'navigation');
					this.update();
					this.draw();
					this._core.trigger('refreshed', null, 'navigation');
				}
			}, this)
		};

		// set default options
		this._core.options = $.extend({}, Navigation.Defaults, this._core.options);

		// register event handlers
		this.$element.on(this._handlers);
	};

	/**
	 * Default options.
	 * @public
	 * @todo Rename `slideBy` to `navBy`
	 */
	Navigation.Defaults = {
		nav: false,
		navText: [
			'<span aria-label="' + 'Previous' + '">&#x2039;</span>',
			'<span aria-label="' + 'Next' + '">&#x203a;</span>'
		],
		navSpeed: false,
		navElement: 'button type="button" role="presentation"',
		navContainer: false,
		navContainerClass: 'owl-nav',
		navClass: [
			'owl-prev',
			'owl-next'
		],
		slideBy: 1,
		dotClass: 'owl-dot',
		dotsClass: 'owl-dots',
		dots: true,
		dotsEach: false,
		dotsData: false,
		dotsSpeed: false,
		dotsContainer: false
	};

	/**
	 * Initializes the layout of the plugin and extends the carousel.
	 * @protected
	 */
	Navigation.prototype.initialize = function() {
		var override,
			settings = this._core.settings;

		// create DOM structure for relative navigation
		this._controls.$relative = (settings.navContainer ? $(settings.navContainer)
			: $('<div>').addClass(settings.navContainerClass).appendTo(this.$element)).addClass('disabled');

		this._controls.$previous = $('<' + settings.navElement + '>')
			.addClass(settings.navClass[0])
			.html(settings.navText[0])
			.prependTo(this._controls.$relative)
			.on('click', $.proxy(function(e) {
				this.prev(settings.navSpeed);
			}, this));
		this._controls.$next = $('<' + settings.navElement + '>')
			.addClass(settings.navClass[1])
			.html(settings.navText[1])
			.appendTo(this._controls.$relative)
			.on('click', $.proxy(function(e) {
				this.next(settings.navSpeed);
			}, this));

		// create DOM structure for absolute navigation
		if (!settings.dotsData) {
			this._templates = [ $('<button role="button">')
				.addClass(settings.dotClass)
				.append($('<span>'))
				.prop('outerHTML') ];
		}

		this._controls.$absolute = (settings.dotsContainer ? $(settings.dotsContainer)
			: $('<div>').addClass(settings.dotsClass).appendTo(this.$element)).addClass('disabled');

		this._controls.$absolute.on('click', 'button', $.proxy(function(e) {
			var index = $(e.target).parent().is(this._controls.$absolute)
				? $(e.target).index() : $(e.target).parent().index();

			e.preventDefault();

			this.to(index, settings.dotsSpeed);
		}, this));

		/*$el.on('focusin', function() {
			$(document).off(".carousel");

			$(document).on('keydown.carousel', function(e) {
				if(e.keyCode == 37) {
					$el.trigger('prev.owl')
				}
				if(e.keyCode == 39) {
					$el.trigger('next.owl')
				}
			});
		});*/

		// override public methods of the carousel
		for (override in this._overrides) {
			this._core[override] = $.proxy(this[override], this);
		}
	};

	/**
	 * Destroys the plugin.
	 * @protected
	 */
	Navigation.prototype.destroy = function() {
		var handler, control, property, override, settings;
		settings = this._core.settings;

		for (handler in this._handlers) {
			this.$element.off(handler, this._handlers[handler]);
		}
		for (control in this._controls) {
			if (control === '$relative' && settings.navContainer) {
				this._controls[control].html('');
			} else {
				this._controls[control].remove();
			}
		}
		for (override in this.overides) {
			this._core[override] = this._overrides[override];
		}
		for (property in Object.getOwnPropertyNames(this)) {
			typeof this[property] != 'function' && (this[property] = null);
		}
	};

	/**
	 * Updates the internal state.
	 * @protected
	 */
	Navigation.prototype.update = function() {
		var i, j, k,
			lower = this._core.clones().length / 2,
			upper = lower + this._core.items().length,
			maximum = this._core.maximum(true),
			settings = this._core.settings,
			size = settings.center || settings.autoWidth || settings.dotsData
				? 1 : settings.dotsEach || settings.items;

		if (settings.slideBy !== 'page') {
			settings.slideBy = Math.min(settings.slideBy, settings.items);
		}

		if (settings.dots || settings.slideBy == 'page') {
			this._pages = [];

			for (i = lower, j = 0, k = 0; i < upper; i++) {
				if (j >= size || j === 0) {
					this._pages.push({
						start: Math.min(maximum, i - lower),
						end: i - lower + size - 1
					});
					if (Math.min(maximum, i - lower) === maximum) {
						break;
					}
					j = 0, ++k;
				}
				j += this._core.mergers(this._core.relative(i));
			}
		}
	};

	/**
	 * Draws the user interface.
	 * @todo The option `dotsData` wont work.
	 * @protected
	 */
	Navigation.prototype.draw = function() {
		var difference,
			settings = this._core.settings,
			disabled = this._core.items().length <= settings.items,
			index = this._core.relative(this._core.current()),
			loop = settings.loop || settings.rewind;

		this._controls.$relative.toggleClass('disabled', !settings.nav || disabled);

		if (settings.nav) {
			this._controls.$previous.toggleClass('disabled', !loop && index <= this._core.minimum(true));
			this._controls.$next.toggleClass('disabled', !loop && index >= this._core.maximum(true));
		}

		this._controls.$absolute.toggleClass('disabled', !settings.dots || disabled);

		if (settings.dots) {
			difference = this._pages.length - this._controls.$absolute.children().length;

			if (settings.dotsData && difference !== 0) {
				this._controls.$absolute.html(this._templates.join(''));
			} else if (difference > 0) {
				this._controls.$absolute.append(new Array(difference + 1).join(this._templates[0]));
			} else if (difference < 0) {
				this._controls.$absolute.children().slice(difference).remove();
			}

			this._controls.$absolute.find('.active').removeClass('active');
			this._controls.$absolute.children().eq($.inArray(this.current(), this._pages)).addClass('active');
		}
	};

	/**
	 * Extends event data.
	 * @protected
	 * @param {Event} event - The event object which gets thrown.
	 */
	Navigation.prototype.onTrigger = function(event) {
		var settings = this._core.settings;

		event.page = {
			index: $.inArray(this.current(), this._pages),
			count: this._pages.length,
			size: settings && (settings.center || settings.autoWidth || settings.dotsData
				? 1 : settings.dotsEach || settings.items)
		};
	};

	/**
	 * Gets the current page position of the carousel.
	 * @protected
	 * @returns {Number}
	 */
	Navigation.prototype.current = function() {
		var current = this._core.relative(this._core.current());
		return $.grep(this._pages, $.proxy(function(page, index) {
			return page.start <= current && page.end >= current;
		}, this)).pop();
	};

	/**
	 * Gets the current succesor/predecessor position.
	 * @protected
	 * @returns {Number}
	 */
	Navigation.prototype.getPosition = function(successor) {
		var position, length,
			settings = this._core.settings;

		if (settings.slideBy == 'page') {
			position = $.inArray(this.current(), this._pages);
			length = this._pages.length;
			successor ? ++position : --position;
			position = this._pages[((position % length) + length) % length].start;
		} else {
			position = this._core.relative(this._core.current());
			length = this._core.items().length;
			successor ? position += settings.slideBy : position -= settings.slideBy;
		}

		return position;
	};

	/**
	 * Slides to the next item or page.
	 * @public
	 * @param {Number} [speed=false] - The time in milliseconds for the transition.
	 */
	Navigation.prototype.next = function(speed) {
		$.proxy(this._overrides.to, this._core)(this.getPosition(true), speed);
	};

	/**
	 * Slides to the previous item or page.
	 * @public
	 * @param {Number} [speed=false] - The time in milliseconds for the transition.
	 */
	Navigation.prototype.prev = function(speed) {
		$.proxy(this._overrides.to, this._core)(this.getPosition(false), speed);
	};

	/**
	 * Slides to the specified item or page.
	 * @public
	 * @param {Number} position - The position of the item or page.
	 * @param {Number} [speed] - The time in milliseconds for the transition.
	 * @param {Boolean} [standard=false] - Whether to use the standard behaviour or not.
	 */
	Navigation.prototype.to = function(position, speed, standard) {
		var length;

		if (!standard && this._pages.length) {
			length = this._pages.length;
			$.proxy(this._overrides.to, this._core)(this._pages[((position % length) + length) % length].start, speed);
		} else {
			$.proxy(this._overrides.to, this._core)(position, speed);
		}
	};

	$.fn.owlCarousel.Constructor.Plugins.Navigation = Navigation;

})(window.Zepto || window.jQuery, window, document);

/**
 * Hash Plugin
 * @version 2.3.4
 * @author Artus Kolanowski
 * @author David Deutsch
 * @license The MIT License (MIT)
 */
;(function($, window, document, undefined) {
	'use strict';

	/**
	 * Creates the hash plugin.
	 * @class The Hash Plugin
	 * @param {Owl} carousel - The Owl Carousel
	 */
	var Hash = function(carousel) {
		/**
		 * Reference to the core.
		 * @protected
		 * @type {Owl}
		 */
		this._core = carousel;

		/**
		 * Hash index for the items.
		 * @protected
		 * @type {Object}
		 */
		this._hashes = {};

		/**
		 * The carousel element.
		 * @type {jQuery}
		 */
		this.$element = this._core.$element;

		/**
		 * All event handlers.
		 * @protected
		 * @type {Object}
		 */
		this._handlers = {
			'initialized.owl.carousel': $.proxy(function(e) {
				if (e.namespace && this._core.settings.startPosition === 'URLHash') {
					$(window).trigger('hashchange.owl.navigation');
				}
			}, this),
			'prepared.owl.carousel': $.proxy(function(e) {
				if (e.namespace) {
					var hash = $(e.content).find('[data-hash]').addBack('[data-hash]').attr('data-hash');

					if (!hash) {
						return;
					}

					this._hashes[hash] = e.content;
				}
			}, this),
			'changed.owl.carousel': $.proxy(function(e) {
				if (e.namespace && e.property.name === 'position') {
					var current = this._core.items(this._core.relative(this._core.current())),
						hash = $.map(this._hashes, function(item, hash) {
							return item === current ? hash : null;
						}).join();

					if (!hash || window.location.hash.slice(1) === hash) {
						return;
					}

					window.location.hash = hash;
				}
			}, this)
		};

		// set default options
		this._core.options = $.extend({}, Hash.Defaults, this._core.options);

		// register the event handlers
		this.$element.on(this._handlers);

		// register event listener for hash navigation
		$(window).on('hashchange.owl.navigation', $.proxy(function(e) {
			var hash = window.location.hash.substring(1),
				items = this._core.$stage.children(),
				position = this._hashes[hash] && items.index(this._hashes[hash]);

			if (position === undefined || position === this._core.current()) {
				return;
			}

			this._core.to(this._core.relative(position), false, true);
		}, this));
	};

	/**
	 * Default options.
	 * @public
	 */
	Hash.Defaults = {
		URLhashListener: false
	};

	/**
	 * Destroys the plugin.
	 * @public
	 */
	Hash.prototype.destroy = function() {
		var handler, property;

		$(window).off('hashchange.owl.navigation');

		for (handler in this._handlers) {
			this._core.$element.off(handler, this._handlers[handler]);
		}
		for (property in Object.getOwnPropertyNames(this)) {
			typeof this[property] != 'function' && (this[property] = null);
		}
	};

	$.fn.owlCarousel.Constructor.Plugins.Hash = Hash;

})(window.Zepto || window.jQuery, window, document);

/**
 * Support Plugin
 *
 * @version 2.3.4
 * @author Vivid Planet Software GmbH
 * @author Artus Kolanowski
 * @author David Deutsch
 * @license The MIT License (MIT)
 */
;(function($, window, document, undefined) {

	var style = $('<support>').get(0).style,
		prefixes = 'Webkit Moz O ms'.split(' '),
		events = {
			transition: {
				end: {
					WebkitTransition: 'webkitTransitionEnd',
					MozTransition: 'transitionend',
					OTransition: 'oTransitionEnd',
					transition: 'transitionend'
				}
			},
			animation: {
				end: {
					WebkitAnimation: 'webkitAnimationEnd',
					MozAnimation: 'animationend',
					OAnimation: 'oAnimationEnd',
					animation: 'animationend'
				}
			}
		},
		tests = {
			csstransforms: function() {
				return !!test('transform');
			},
			csstransforms3d: function() {
				return !!test('perspective');
			},
			csstransitions: function() {
				return !!test('transition');
			},
			cssanimations: function() {
				return !!test('animation');
			}
		};

	function test(property, prefixed) {
		var result = false,
			upper = property.charAt(0).toUpperCase() + property.slice(1);

		$.each((property + ' ' + prefixes.join(upper + ' ') + upper).split(' '), function(i, property) {
			if (style[property] !== undefined) {
				result = prefixed ? property : true;
				return false;
			}
		});

		return result;
	}

	function prefixed(property) {
		return test(property, true);
	}

	if (tests.csstransitions()) {
		/* jshint -W053 */
		$.support.transition = new String(prefixed('transition'))
		$.support.transition.end = events.transition.end[ $.support.transition ];
	}

	if (tests.cssanimations()) {
		/* jshint -W053 */
		$.support.animation = new String(prefixed('animation'))
		$.support.animation.end = events.animation.end[ $.support.animation ];
	}

	if (tests.csstransforms()) {
		/* jshint -W053 */
		$.support.transform = new String(prefixed('transform'));
		$.support.transform3d = tests.csstransforms3d();
	}

})(window.Zepto || window.jQuery, window, document);
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiIiwic291cmNlcyI6WyJvd2xjYXJvdXNlbDIvb3dsLmNhcm91c2VsLmpzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qKlxyXG4gKiBPd2wgQ2Fyb3VzZWwgdjIuMy40XHJcbiAqIENvcHlyaWdodCAyMDEzLTIwMTggRGF2aWQgRGV1dHNjaFxyXG4gKiBMaWNlbnNlZCB1bmRlcjogU0VFIExJQ0VOU0UgSU4gaHR0cHM6Ly9naXRodWIuY29tL093bENhcm91c2VsMi9Pd2xDYXJvdXNlbDIvYmxvYi9tYXN0ZXIvTElDRU5TRVxyXG4gKi9cclxuLyoqXHJcbiAqIE93bCBjYXJvdXNlbFxyXG4gKiBAdmVyc2lvbiAyLjMuNFxyXG4gKiBAYXV0aG9yIEJhcnRvc3ogV29qY2llY2hvd3NraVxyXG4gKiBAYXV0aG9yIERhdmlkIERldXRzY2hcclxuICogQGxpY2Vuc2UgVGhlIE1JVCBMaWNlbnNlIChNSVQpXHJcbiAqIEB0b2RvIExhenkgTG9hZCBJY29uXHJcbiAqIEB0b2RvIHByZXZlbnQgYW5pbWF0aW9uZW5kIGJ1YmxpbmdcclxuICogQHRvZG8gaXRlbXNTY2FsZVVwXHJcbiAqIEB0b2RvIFRlc3QgWmVwdG9cclxuICogQHRvZG8gc3RhZ2VQYWRkaW5nIGNhbGN1bGF0ZSB3cm9uZyBhY3RpdmUgY2xhc3Nlc1xyXG4gKi9cclxuOyhmdW5jdGlvbigkLCB3aW5kb3csIGRvY3VtZW50LCB1bmRlZmluZWQpIHtcclxuXHJcblx0LyoqXHJcblx0ICogQ3JlYXRlcyBhIGNhcm91c2VsLlxyXG5cdCAqIEBjbGFzcyBUaGUgT3dsIENhcm91c2VsLlxyXG5cdCAqIEBwdWJsaWNcclxuXHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fGpRdWVyeX0gZWxlbWVudCAtIFRoZSBlbGVtZW50IHRvIGNyZWF0ZSB0aGUgY2Fyb3VzZWwgZm9yLlxyXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSBbb3B0aW9uc10gLSBUaGUgb3B0aW9uc1xyXG5cdCAqL1xyXG5cdGZ1bmN0aW9uIE93bChlbGVtZW50LCBvcHRpb25zKSB7XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBDdXJyZW50IHNldHRpbmdzIGZvciB0aGUgY2Fyb3VzZWwuXHJcblx0XHQgKiBAcHVibGljXHJcblx0XHQgKi9cclxuXHRcdHRoaXMuc2V0dGluZ3MgPSBudWxsO1xyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogQ3VycmVudCBvcHRpb25zIHNldCBieSB0aGUgY2FsbGVyIGluY2x1ZGluZyBkZWZhdWx0cy5cclxuXHRcdCAqIEBwdWJsaWNcclxuXHRcdCAqL1xyXG5cdFx0dGhpcy5vcHRpb25zID0gJC5leHRlbmQoe30sIE93bC5EZWZhdWx0cywgb3B0aW9ucyk7XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBQbHVnaW4gZWxlbWVudC5cclxuXHRcdCAqIEBwdWJsaWNcclxuXHRcdCAqL1xyXG5cdFx0dGhpcy4kZWxlbWVudCA9ICQoZWxlbWVudCk7XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBQcm94aWVkIGV2ZW50IGhhbmRsZXJzLlxyXG5cdFx0ICogQHByb3RlY3RlZFxyXG5cdFx0ICovXHJcblx0XHR0aGlzLl9oYW5kbGVycyA9IHt9O1xyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogUmVmZXJlbmNlcyB0byB0aGUgcnVubmluZyBwbHVnaW5zIG9mIHRoaXMgY2Fyb3VzZWwuXHJcblx0XHQgKiBAcHJvdGVjdGVkXHJcblx0XHQgKi9cclxuXHRcdHRoaXMuX3BsdWdpbnMgPSB7fTtcclxuXHJcblx0XHQvKipcclxuXHRcdCAqIEN1cnJlbnRseSBzdXBwcmVzc2VkIGV2ZW50cyB0byBwcmV2ZW50IHRoZW0gZnJvbSBiZWluZyByZXRyaWdnZXJlZC5cclxuXHRcdCAqIEBwcm90ZWN0ZWRcclxuXHRcdCAqL1xyXG5cdFx0dGhpcy5fc3VwcmVzcyA9IHt9O1xyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogQWJzb2x1dGUgY3VycmVudCBwb3NpdGlvbi5cclxuXHRcdCAqIEBwcm90ZWN0ZWRcclxuXHRcdCAqL1xyXG5cdFx0dGhpcy5fY3VycmVudCA9IG51bGw7XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBBbmltYXRpb24gc3BlZWQgaW4gbWlsbGlzZWNvbmRzLlxyXG5cdFx0ICogQHByb3RlY3RlZFxyXG5cdFx0ICovXHJcblx0XHR0aGlzLl9zcGVlZCA9IG51bGw7XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBDb29yZGluYXRlcyBvZiBhbGwgaXRlbXMgaW4gcGl4ZWwuXHJcblx0XHQgKiBAdG9kbyBUaGUgbmFtZSBvZiB0aGlzIG1lbWJlciBpcyBtaXNzbGVhZGluZy5cclxuXHRcdCAqIEBwcm90ZWN0ZWRcclxuXHRcdCAqL1xyXG5cdFx0dGhpcy5fY29vcmRpbmF0ZXMgPSBbXTtcclxuXHJcblx0XHQvKipcclxuXHRcdCAqIEN1cnJlbnQgYnJlYWtwb2ludC5cclxuXHRcdCAqIEB0b2RvIFJlYWwgbWVkaWEgcXVlcmllcyB3b3VsZCBiZSBuaWNlLlxyXG5cdFx0ICogQHByb3RlY3RlZFxyXG5cdFx0ICovXHJcblx0XHR0aGlzLl9icmVha3BvaW50ID0gbnVsbDtcclxuXHJcblx0XHQvKipcclxuXHRcdCAqIEN1cnJlbnQgd2lkdGggb2YgdGhlIHBsdWdpbiBlbGVtZW50LlxyXG5cdFx0ICovXHJcblx0XHR0aGlzLl93aWR0aCA9IG51bGw7XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBBbGwgcmVhbCBpdGVtcy5cclxuXHRcdCAqIEBwcm90ZWN0ZWRcclxuXHRcdCAqL1xyXG5cdFx0dGhpcy5faXRlbXMgPSBbXTtcclxuXHJcblx0XHQvKipcclxuXHRcdCAqIEFsbCBjbG9uZWQgaXRlbXMuXHJcblx0XHQgKiBAcHJvdGVjdGVkXHJcblx0XHQgKi9cclxuXHRcdHRoaXMuX2Nsb25lcyA9IFtdO1xyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogTWVyZ2UgdmFsdWVzIG9mIGFsbCBpdGVtcy5cclxuXHRcdCAqIEB0b2RvIE1heWJlIHRoaXMgY291bGQgYmUgcGFydCBvZiBhIHBsdWdpbi5cclxuXHRcdCAqIEBwcm90ZWN0ZWRcclxuXHRcdCAqL1xyXG5cdFx0dGhpcy5fbWVyZ2VycyA9IFtdO1xyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogV2lkdGhzIG9mIGFsbCBpdGVtcy5cclxuXHRcdCAqL1xyXG5cdFx0dGhpcy5fd2lkdGhzID0gW107XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBJbnZhbGlkYXRlZCBwYXJ0cyB3aXRoaW4gdGhlIHVwZGF0ZSBwcm9jZXNzLlxyXG5cdFx0ICogQHByb3RlY3RlZFxyXG5cdFx0ICovXHJcblx0XHR0aGlzLl9pbnZhbGlkYXRlZCA9IHt9O1xyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogT3JkZXJlZCBsaXN0IG9mIHdvcmtlcnMgZm9yIHRoZSB1cGRhdGUgcHJvY2Vzcy5cclxuXHRcdCAqIEBwcm90ZWN0ZWRcclxuXHRcdCAqL1xyXG5cdFx0dGhpcy5fcGlwZSA9IFtdO1xyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogQ3VycmVudCBzdGF0ZSBpbmZvcm1hdGlvbiBmb3IgdGhlIGRyYWcgb3BlcmF0aW9uLlxyXG5cdFx0ICogQHRvZG8gIzI2MVxyXG5cdFx0ICogQHByb3RlY3RlZFxyXG5cdFx0ICovXHJcblx0XHR0aGlzLl9kcmFnID0ge1xyXG5cdFx0XHR0aW1lOiBudWxsLFxyXG5cdFx0XHR0YXJnZXQ6IG51bGwsXHJcblx0XHRcdHBvaW50ZXI6IG51bGwsXHJcblx0XHRcdHN0YWdlOiB7XHJcblx0XHRcdFx0c3RhcnQ6IG51bGwsXHJcblx0XHRcdFx0Y3VycmVudDogbnVsbFxyXG5cdFx0XHR9LFxyXG5cdFx0XHRkaXJlY3Rpb246IG51bGxcclxuXHRcdH07XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBDdXJyZW50IHN0YXRlIGluZm9ybWF0aW9uIGFuZCB0aGVpciB0YWdzLlxyXG5cdFx0ICogQHR5cGUge09iamVjdH1cclxuXHRcdCAqIEBwcm90ZWN0ZWRcclxuXHRcdCAqL1xyXG5cdFx0dGhpcy5fc3RhdGVzID0ge1xyXG5cdFx0XHRjdXJyZW50OiB7fSxcclxuXHRcdFx0dGFnczoge1xyXG5cdFx0XHRcdCdpbml0aWFsaXppbmcnOiBbICdidXN5JyBdLFxyXG5cdFx0XHRcdCdhbmltYXRpbmcnOiBbICdidXN5JyBdLFxyXG5cdFx0XHRcdCdkcmFnZ2luZyc6IFsgJ2ludGVyYWN0aW5nJyBdXHJcblx0XHRcdH1cclxuXHRcdH07XHJcblxyXG5cdFx0JC5lYWNoKFsgJ29uUmVzaXplJywgJ29uVGhyb3R0bGVkUmVzaXplJyBdLCAkLnByb3h5KGZ1bmN0aW9uKGksIGhhbmRsZXIpIHtcclxuXHRcdFx0dGhpcy5faGFuZGxlcnNbaGFuZGxlcl0gPSAkLnByb3h5KHRoaXNbaGFuZGxlcl0sIHRoaXMpO1xyXG5cdFx0fSwgdGhpcykpO1xyXG5cclxuXHRcdCQuZWFjaChPd2wuUGx1Z2lucywgJC5wcm94eShmdW5jdGlvbihrZXksIHBsdWdpbikge1xyXG5cdFx0XHR0aGlzLl9wbHVnaW5zW2tleS5jaGFyQXQoMCkudG9Mb3dlckNhc2UoKSArIGtleS5zbGljZSgxKV1cclxuXHRcdFx0XHQ9IG5ldyBwbHVnaW4odGhpcyk7XHJcblx0XHR9LCB0aGlzKSk7XHJcblxyXG5cdFx0JC5lYWNoKE93bC5Xb3JrZXJzLCAkLnByb3h5KGZ1bmN0aW9uKHByaW9yaXR5LCB3b3JrZXIpIHtcclxuXHRcdFx0dGhpcy5fcGlwZS5wdXNoKHtcclxuXHRcdFx0XHQnZmlsdGVyJzogd29ya2VyLmZpbHRlcixcclxuXHRcdFx0XHQncnVuJzogJC5wcm94eSh3b3JrZXIucnVuLCB0aGlzKVxyXG5cdFx0XHR9KTtcclxuXHRcdH0sIHRoaXMpKTtcclxuXHJcblx0XHR0aGlzLnNldHVwKCk7XHJcblx0XHR0aGlzLmluaXRpYWxpemUoKTtcclxuXHR9XHJcblxyXG5cdC8qKlxyXG5cdCAqIERlZmF1bHQgb3B0aW9ucyBmb3IgdGhlIGNhcm91c2VsLlxyXG5cdCAqIEBwdWJsaWNcclxuXHQgKi9cclxuXHRPd2wuRGVmYXVsdHMgPSB7XHJcblx0XHRpdGVtczogMyxcclxuXHRcdGxvb3A6IGZhbHNlLFxyXG5cdFx0Y2VudGVyOiBmYWxzZSxcclxuXHRcdHJld2luZDogZmFsc2UsXHJcblx0XHRjaGVja1Zpc2liaWxpdHk6IHRydWUsXHJcblxyXG5cdFx0bW91c2VEcmFnOiB0cnVlLFxyXG5cdFx0dG91Y2hEcmFnOiB0cnVlLFxyXG5cdFx0cHVsbERyYWc6IHRydWUsXHJcblx0XHRmcmVlRHJhZzogZmFsc2UsXHJcblxyXG5cdFx0bWFyZ2luOiAwLFxyXG5cdFx0c3RhZ2VQYWRkaW5nOiAwLFxyXG5cclxuXHRcdG1lcmdlOiBmYWxzZSxcclxuXHRcdG1lcmdlRml0OiB0cnVlLFxyXG5cdFx0YXV0b1dpZHRoOiBmYWxzZSxcclxuXHJcblx0XHRzdGFydFBvc2l0aW9uOiAwLFxyXG5cdFx0cnRsOiBmYWxzZSxcclxuXHJcblx0XHRzbWFydFNwZWVkOiAyNTAsXHJcblx0XHRmbHVpZFNwZWVkOiBmYWxzZSxcclxuXHRcdGRyYWdFbmRTcGVlZDogZmFsc2UsXHJcblxyXG5cdFx0cmVzcG9uc2l2ZToge30sXHJcblx0XHRyZXNwb25zaXZlUmVmcmVzaFJhdGU6IDIwMCxcclxuXHRcdHJlc3BvbnNpdmVCYXNlRWxlbWVudDogd2luZG93LFxyXG5cclxuXHRcdGZhbGxiYWNrRWFzaW5nOiAnc3dpbmcnLFxyXG5cdFx0c2xpZGVUcmFuc2l0aW9uOiAnJyxcclxuXHJcblx0XHRpbmZvOiBmYWxzZSxcclxuXHJcblx0XHRuZXN0ZWRJdGVtU2VsZWN0b3I6IGZhbHNlLFxyXG5cdFx0aXRlbUVsZW1lbnQ6ICdkaXYnLFxyXG5cdFx0c3RhZ2VFbGVtZW50OiAnZGl2JyxcclxuXHJcblx0XHRyZWZyZXNoQ2xhc3M6ICdvd2wtcmVmcmVzaCcsXHJcblx0XHRsb2FkZWRDbGFzczogJ293bC1sb2FkZWQnLFxyXG5cdFx0bG9hZGluZ0NsYXNzOiAnb3dsLWxvYWRpbmcnLFxyXG5cdFx0cnRsQ2xhc3M6ICdvd2wtcnRsJyxcclxuXHRcdHJlc3BvbnNpdmVDbGFzczogJ293bC1yZXNwb25zaXZlJyxcclxuXHRcdGRyYWdDbGFzczogJ293bC1kcmFnJyxcclxuXHRcdGl0ZW1DbGFzczogJ293bC1pdGVtJyxcclxuXHRcdHN0YWdlQ2xhc3M6ICdvd2wtc3RhZ2UnLFxyXG5cdFx0c3RhZ2VPdXRlckNsYXNzOiAnb3dsLXN0YWdlLW91dGVyJyxcclxuXHRcdGdyYWJDbGFzczogJ293bC1ncmFiJ1xyXG5cdH07XHJcblxyXG5cdC8qKlxyXG5cdCAqIEVudW1lcmF0aW9uIGZvciB3aWR0aC5cclxuXHQgKiBAcHVibGljXHJcblx0ICogQHJlYWRvbmx5XHJcblx0ICogQGVudW0ge1N0cmluZ31cclxuXHQgKi9cclxuXHRPd2wuV2lkdGggPSB7XHJcblx0XHREZWZhdWx0OiAnZGVmYXVsdCcsXHJcblx0XHRJbm5lcjogJ2lubmVyJyxcclxuXHRcdE91dGVyOiAnb3V0ZXInXHJcblx0fTtcclxuXHJcblx0LyoqXHJcblx0ICogRW51bWVyYXRpb24gZm9yIHR5cGVzLlxyXG5cdCAqIEBwdWJsaWNcclxuXHQgKiBAcmVhZG9ubHlcclxuXHQgKiBAZW51bSB7U3RyaW5nfVxyXG5cdCAqL1xyXG5cdE93bC5UeXBlID0ge1xyXG5cdFx0RXZlbnQ6ICdldmVudCcsXHJcblx0XHRTdGF0ZTogJ3N0YXRlJ1xyXG5cdH07XHJcblxyXG5cdC8qKlxyXG5cdCAqIENvbnRhaW5zIGFsbCByZWdpc3RlcmVkIHBsdWdpbnMuXHJcblx0ICogQHB1YmxpY1xyXG5cdCAqL1xyXG5cdE93bC5QbHVnaW5zID0ge307XHJcblxyXG5cdC8qKlxyXG5cdCAqIExpc3Qgb2Ygd29ya2VycyBpbnZvbHZlZCBpbiB0aGUgdXBkYXRlIHByb2Nlc3MuXHJcblx0ICovXHJcblx0T3dsLldvcmtlcnMgPSBbIHtcclxuXHRcdGZpbHRlcjogWyAnd2lkdGgnLCAnc2V0dGluZ3MnIF0sXHJcblx0XHRydW46IGZ1bmN0aW9uKCkge1xyXG5cdFx0XHR0aGlzLl93aWR0aCA9IHRoaXMuJGVsZW1lbnQud2lkdGgoKTtcclxuXHRcdH1cclxuXHR9LCB7XHJcblx0XHRmaWx0ZXI6IFsgJ3dpZHRoJywgJ2l0ZW1zJywgJ3NldHRpbmdzJyBdLFxyXG5cdFx0cnVuOiBmdW5jdGlvbihjYWNoZSkge1xyXG5cdFx0XHRjYWNoZS5jdXJyZW50ID0gdGhpcy5faXRlbXMgJiYgdGhpcy5faXRlbXNbdGhpcy5yZWxhdGl2ZSh0aGlzLl9jdXJyZW50KV07XHJcblx0XHR9XHJcblx0fSwge1xyXG5cdFx0ZmlsdGVyOiBbICdpdGVtcycsICdzZXR0aW5ncycgXSxcclxuXHRcdHJ1bjogZnVuY3Rpb24oKSB7XHJcblx0XHRcdHRoaXMuJHN0YWdlLmNoaWxkcmVuKCcuY2xvbmVkJykucmVtb3ZlKCk7XHJcblx0XHR9XHJcblx0fSwge1xyXG5cdFx0ZmlsdGVyOiBbICd3aWR0aCcsICdpdGVtcycsICdzZXR0aW5ncycgXSxcclxuXHRcdHJ1bjogZnVuY3Rpb24oY2FjaGUpIHtcclxuXHRcdFx0dmFyIG1hcmdpbiA9IHRoaXMuc2V0dGluZ3MubWFyZ2luIHx8ICcnLFxyXG5cdFx0XHRcdGdyaWQgPSAhdGhpcy5zZXR0aW5ncy5hdXRvV2lkdGgsXHJcblx0XHRcdFx0cnRsID0gdGhpcy5zZXR0aW5ncy5ydGwsXHJcblx0XHRcdFx0Y3NzID0ge1xyXG5cdFx0XHRcdFx0J3dpZHRoJzogJ2F1dG8nLFxyXG5cdFx0XHRcdFx0J21hcmdpbi1sZWZ0JzogcnRsID8gbWFyZ2luIDogJycsXHJcblx0XHRcdFx0XHQnbWFyZ2luLXJpZ2h0JzogcnRsID8gJycgOiBtYXJnaW5cclxuXHRcdFx0XHR9O1xyXG5cclxuXHRcdFx0IWdyaWQgJiYgdGhpcy4kc3RhZ2UuY2hpbGRyZW4oKS5jc3MoY3NzKTtcclxuXHJcblx0XHRcdGNhY2hlLmNzcyA9IGNzcztcclxuXHRcdH1cclxuXHR9LCB7XHJcblx0XHRmaWx0ZXI6IFsgJ3dpZHRoJywgJ2l0ZW1zJywgJ3NldHRpbmdzJyBdLFxyXG5cdFx0cnVuOiBmdW5jdGlvbihjYWNoZSkge1xyXG5cdFx0XHR2YXIgd2lkdGggPSAodGhpcy53aWR0aCgpIC8gdGhpcy5zZXR0aW5ncy5pdGVtcykudG9GaXhlZCgzKSAtIHRoaXMuc2V0dGluZ3MubWFyZ2luLFxyXG5cdFx0XHRcdG1lcmdlID0gbnVsbCxcclxuXHRcdFx0XHRpdGVyYXRvciA9IHRoaXMuX2l0ZW1zLmxlbmd0aCxcclxuXHRcdFx0XHRncmlkID0gIXRoaXMuc2V0dGluZ3MuYXV0b1dpZHRoLFxyXG5cdFx0XHRcdHdpZHRocyA9IFtdO1xyXG5cclxuXHRcdFx0Y2FjaGUuaXRlbXMgPSB7XHJcblx0XHRcdFx0bWVyZ2U6IGZhbHNlLFxyXG5cdFx0XHRcdHdpZHRoOiB3aWR0aFxyXG5cdFx0XHR9O1xyXG5cclxuXHRcdFx0d2hpbGUgKGl0ZXJhdG9yLS0pIHtcclxuXHRcdFx0XHRtZXJnZSA9IHRoaXMuX21lcmdlcnNbaXRlcmF0b3JdO1xyXG5cdFx0XHRcdG1lcmdlID0gdGhpcy5zZXR0aW5ncy5tZXJnZUZpdCAmJiBNYXRoLm1pbihtZXJnZSwgdGhpcy5zZXR0aW5ncy5pdGVtcykgfHwgbWVyZ2U7XHJcblxyXG5cdFx0XHRcdGNhY2hlLml0ZW1zLm1lcmdlID0gbWVyZ2UgPiAxIHx8IGNhY2hlLml0ZW1zLm1lcmdlO1xyXG5cclxuXHRcdFx0XHR3aWR0aHNbaXRlcmF0b3JdID0gIWdyaWQgPyB0aGlzLl9pdGVtc1tpdGVyYXRvcl0ud2lkdGgoKSA6IHdpZHRoICogbWVyZ2U7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdHRoaXMuX3dpZHRocyA9IHdpZHRocztcclxuXHRcdH1cclxuXHR9LCB7XHJcblx0XHRmaWx0ZXI6IFsgJ2l0ZW1zJywgJ3NldHRpbmdzJyBdLFxyXG5cdFx0cnVuOiBmdW5jdGlvbigpIHtcclxuXHRcdFx0dmFyIGNsb25lcyA9IFtdLFxyXG5cdFx0XHRcdGl0ZW1zID0gdGhpcy5faXRlbXMsXHJcblx0XHRcdFx0c2V0dGluZ3MgPSB0aGlzLnNldHRpbmdzLFxyXG5cdFx0XHRcdC8vIFRPRE86IFNob3VsZCBiZSBjb21wdXRlZCBmcm9tIG51bWJlciBvZiBtaW4gd2lkdGggaXRlbXMgaW4gc3RhZ2VcclxuXHRcdFx0XHR2aWV3ID0gTWF0aC5tYXgoc2V0dGluZ3MuaXRlbXMgKiAyLCA0KSxcclxuXHRcdFx0XHRzaXplID0gTWF0aC5jZWlsKGl0ZW1zLmxlbmd0aCAvIDIpICogMixcclxuXHRcdFx0XHRyZXBlYXQgPSBzZXR0aW5ncy5sb29wICYmIGl0ZW1zLmxlbmd0aCA/IHNldHRpbmdzLnJld2luZCA/IHZpZXcgOiBNYXRoLm1heCh2aWV3LCBzaXplKSA6IDAsXHJcblx0XHRcdFx0YXBwZW5kID0gJycsXHJcblx0XHRcdFx0cHJlcGVuZCA9ICcnO1xyXG5cclxuXHRcdFx0cmVwZWF0IC89IDI7XHJcblxyXG5cdFx0XHR3aGlsZSAocmVwZWF0ID4gMCkge1xyXG5cdFx0XHRcdC8vIFN3aXRjaCB0byBvbmx5IHVzaW5nIGFwcGVuZGVkIGNsb25lc1xyXG5cdFx0XHRcdGNsb25lcy5wdXNoKHRoaXMubm9ybWFsaXplKGNsb25lcy5sZW5ndGggLyAyLCB0cnVlKSk7XHJcblx0XHRcdFx0YXBwZW5kID0gYXBwZW5kICsgaXRlbXNbY2xvbmVzW2Nsb25lcy5sZW5ndGggLSAxXV1bMF0ub3V0ZXJIVE1MO1xyXG5cdFx0XHRcdGNsb25lcy5wdXNoKHRoaXMubm9ybWFsaXplKGl0ZW1zLmxlbmd0aCAtIDEgLSAoY2xvbmVzLmxlbmd0aCAtIDEpIC8gMiwgdHJ1ZSkpO1xyXG5cdFx0XHRcdHByZXBlbmQgPSBpdGVtc1tjbG9uZXNbY2xvbmVzLmxlbmd0aCAtIDFdXVswXS5vdXRlckhUTUwgKyBwcmVwZW5kO1xyXG5cdFx0XHRcdHJlcGVhdCAtPSAxO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHR0aGlzLl9jbG9uZXMgPSBjbG9uZXM7XHJcblxyXG5cdFx0XHQkKGFwcGVuZCkuYWRkQ2xhc3MoJ2Nsb25lZCcpLmFwcGVuZFRvKHRoaXMuJHN0YWdlKTtcclxuXHRcdFx0JChwcmVwZW5kKS5hZGRDbGFzcygnY2xvbmVkJykucHJlcGVuZFRvKHRoaXMuJHN0YWdlKTtcclxuXHRcdH1cclxuXHR9LCB7XHJcblx0XHRmaWx0ZXI6IFsgJ3dpZHRoJywgJ2l0ZW1zJywgJ3NldHRpbmdzJyBdLFxyXG5cdFx0cnVuOiBmdW5jdGlvbigpIHtcclxuXHRcdFx0dmFyIHJ0bCA9IHRoaXMuc2V0dGluZ3MucnRsID8gMSA6IC0xLFxyXG5cdFx0XHRcdHNpemUgPSB0aGlzLl9jbG9uZXMubGVuZ3RoICsgdGhpcy5faXRlbXMubGVuZ3RoLFxyXG5cdFx0XHRcdGl0ZXJhdG9yID0gLTEsXHJcblx0XHRcdFx0cHJldmlvdXMgPSAwLFxyXG5cdFx0XHRcdGN1cnJlbnQgPSAwLFxyXG5cdFx0XHRcdGNvb3JkaW5hdGVzID0gW107XHJcblxyXG5cdFx0XHR3aGlsZSAoKytpdGVyYXRvciA8IHNpemUpIHtcclxuXHRcdFx0XHRwcmV2aW91cyA9IGNvb3JkaW5hdGVzW2l0ZXJhdG9yIC0gMV0gfHwgMDtcclxuXHRcdFx0XHRjdXJyZW50ID0gdGhpcy5fd2lkdGhzW3RoaXMucmVsYXRpdmUoaXRlcmF0b3IpXSArIHRoaXMuc2V0dGluZ3MubWFyZ2luO1xyXG5cdFx0XHRcdGNvb3JkaW5hdGVzLnB1c2gocHJldmlvdXMgKyBjdXJyZW50ICogcnRsKTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0dGhpcy5fY29vcmRpbmF0ZXMgPSBjb29yZGluYXRlcztcclxuXHRcdH1cclxuXHR9LCB7XHJcblx0XHRmaWx0ZXI6IFsgJ3dpZHRoJywgJ2l0ZW1zJywgJ3NldHRpbmdzJyBdLFxyXG5cdFx0cnVuOiBmdW5jdGlvbigpIHtcclxuXHRcdFx0dmFyIHBhZGRpbmcgPSB0aGlzLnNldHRpbmdzLnN0YWdlUGFkZGluZyxcclxuXHRcdFx0XHRjb29yZGluYXRlcyA9IHRoaXMuX2Nvb3JkaW5hdGVzLFxyXG5cdFx0XHRcdGNzcyA9IHtcclxuXHRcdFx0XHRcdCd3aWR0aCc6IE1hdGguY2VpbChNYXRoLmFicyhjb29yZGluYXRlc1tjb29yZGluYXRlcy5sZW5ndGggLSAxXSkpICsgcGFkZGluZyAqIDIsXHJcblx0XHRcdFx0XHQncGFkZGluZy1sZWZ0JzogcGFkZGluZyB8fCAnJyxcclxuXHRcdFx0XHRcdCdwYWRkaW5nLXJpZ2h0JzogcGFkZGluZyB8fCAnJ1xyXG5cdFx0XHRcdH07XHJcblxyXG5cdFx0XHR0aGlzLiRzdGFnZS5jc3MoY3NzKTtcclxuXHRcdH1cclxuXHR9LCB7XHJcblx0XHRmaWx0ZXI6IFsgJ3dpZHRoJywgJ2l0ZW1zJywgJ3NldHRpbmdzJyBdLFxyXG5cdFx0cnVuOiBmdW5jdGlvbihjYWNoZSkge1xyXG5cdFx0XHR2YXIgaXRlcmF0b3IgPSB0aGlzLl9jb29yZGluYXRlcy5sZW5ndGgsXHJcblx0XHRcdFx0Z3JpZCA9ICF0aGlzLnNldHRpbmdzLmF1dG9XaWR0aCxcclxuXHRcdFx0XHRpdGVtcyA9IHRoaXMuJHN0YWdlLmNoaWxkcmVuKCk7XHJcblxyXG5cdFx0XHRpZiAoZ3JpZCAmJiBjYWNoZS5pdGVtcy5tZXJnZSkge1xyXG5cdFx0XHRcdHdoaWxlIChpdGVyYXRvci0tKSB7XHJcblx0XHRcdFx0XHRjYWNoZS5jc3Mud2lkdGggPSB0aGlzLl93aWR0aHNbdGhpcy5yZWxhdGl2ZShpdGVyYXRvcildO1xyXG5cdFx0XHRcdFx0aXRlbXMuZXEoaXRlcmF0b3IpLmNzcyhjYWNoZS5jc3MpO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fSBlbHNlIGlmIChncmlkKSB7XHJcblx0XHRcdFx0Y2FjaGUuY3NzLndpZHRoID0gY2FjaGUuaXRlbXMud2lkdGg7XHJcblx0XHRcdFx0aXRlbXMuY3NzKGNhY2hlLmNzcyk7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHR9LCB7XHJcblx0XHRmaWx0ZXI6IFsgJ2l0ZW1zJyBdLFxyXG5cdFx0cnVuOiBmdW5jdGlvbigpIHtcclxuXHRcdFx0dGhpcy5fY29vcmRpbmF0ZXMubGVuZ3RoIDwgMSAmJiB0aGlzLiRzdGFnZS5yZW1vdmVBdHRyKCdzdHlsZScpO1xyXG5cdFx0fVxyXG5cdH0sIHtcclxuXHRcdGZpbHRlcjogWyAnd2lkdGgnLCAnaXRlbXMnLCAnc2V0dGluZ3MnIF0sXHJcblx0XHRydW46IGZ1bmN0aW9uKGNhY2hlKSB7XHJcblx0XHRcdGNhY2hlLmN1cnJlbnQgPSBjYWNoZS5jdXJyZW50ID8gdGhpcy4kc3RhZ2UuY2hpbGRyZW4oKS5pbmRleChjYWNoZS5jdXJyZW50KSA6IDA7XHJcblx0XHRcdGNhY2hlLmN1cnJlbnQgPSBNYXRoLm1heCh0aGlzLm1pbmltdW0oKSwgTWF0aC5taW4odGhpcy5tYXhpbXVtKCksIGNhY2hlLmN1cnJlbnQpKTtcclxuXHRcdFx0dGhpcy5yZXNldChjYWNoZS5jdXJyZW50KTtcclxuXHRcdH1cclxuXHR9LCB7XHJcblx0XHRmaWx0ZXI6IFsgJ3Bvc2l0aW9uJyBdLFxyXG5cdFx0cnVuOiBmdW5jdGlvbigpIHtcclxuXHRcdFx0dGhpcy5hbmltYXRlKHRoaXMuY29vcmRpbmF0ZXModGhpcy5fY3VycmVudCkpO1xyXG5cdFx0fVxyXG5cdH0sIHtcclxuXHRcdGZpbHRlcjogWyAnd2lkdGgnLCAncG9zaXRpb24nLCAnaXRlbXMnLCAnc2V0dGluZ3MnIF0sXHJcblx0XHRydW46IGZ1bmN0aW9uKCkge1xyXG5cdFx0XHR2YXIgcnRsID0gdGhpcy5zZXR0aW5ncy5ydGwgPyAxIDogLTEsXHJcblx0XHRcdFx0cGFkZGluZyA9IHRoaXMuc2V0dGluZ3Muc3RhZ2VQYWRkaW5nICogMixcclxuXHRcdFx0XHRiZWdpbiA9IHRoaXMuY29vcmRpbmF0ZXModGhpcy5jdXJyZW50KCkpICsgcGFkZGluZyxcclxuXHRcdFx0XHRlbmQgPSBiZWdpbiArIHRoaXMud2lkdGgoKSAqIHJ0bCxcclxuXHRcdFx0XHRpbm5lciwgb3V0ZXIsIG1hdGNoZXMgPSBbXSwgaSwgbjtcclxuXHJcblx0XHRcdGZvciAoaSA9IDAsIG4gPSB0aGlzLl9jb29yZGluYXRlcy5sZW5ndGg7IGkgPCBuOyBpKyspIHtcclxuXHRcdFx0XHRpbm5lciA9IHRoaXMuX2Nvb3JkaW5hdGVzW2kgLSAxXSB8fCAwO1xyXG5cdFx0XHRcdG91dGVyID0gTWF0aC5hYnModGhpcy5fY29vcmRpbmF0ZXNbaV0pICsgcGFkZGluZyAqIHJ0bDtcclxuXHJcblx0XHRcdFx0aWYgKCh0aGlzLm9wKGlubmVyLCAnPD0nLCBiZWdpbikgJiYgKHRoaXMub3AoaW5uZXIsICc+JywgZW5kKSkpXHJcblx0XHRcdFx0XHR8fCAodGhpcy5vcChvdXRlciwgJzwnLCBiZWdpbikgJiYgdGhpcy5vcChvdXRlciwgJz4nLCBlbmQpKSkge1xyXG5cdFx0XHRcdFx0bWF0Y2hlcy5wdXNoKGkpO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0dGhpcy4kc3RhZ2UuY2hpbGRyZW4oJy5hY3RpdmUnKS5yZW1vdmVDbGFzcygnYWN0aXZlJyk7XHJcblx0XHRcdHRoaXMuJHN0YWdlLmNoaWxkcmVuKCc6ZXEoJyArIG1hdGNoZXMuam9pbignKSwgOmVxKCcpICsgJyknKS5hZGRDbGFzcygnYWN0aXZlJyk7XHJcblxyXG5cdFx0XHR0aGlzLiRzdGFnZS5jaGlsZHJlbignLmNlbnRlcicpLnJlbW92ZUNsYXNzKCdjZW50ZXInKTtcclxuXHRcdFx0aWYgKHRoaXMuc2V0dGluZ3MuY2VudGVyKSB7XHJcblx0XHRcdFx0dGhpcy4kc3RhZ2UuY2hpbGRyZW4oKS5lcSh0aGlzLmN1cnJlbnQoKSkuYWRkQ2xhc3MoJ2NlbnRlcicpO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblx0fSBdO1xyXG5cclxuXHQvKipcclxuXHQgKiBDcmVhdGUgdGhlIHN0YWdlIERPTSBlbGVtZW50XHJcblx0ICovXHJcblx0T3dsLnByb3RvdHlwZS5pbml0aWFsaXplU3RhZ2UgPSBmdW5jdGlvbigpIHtcclxuXHRcdHRoaXMuJHN0YWdlID0gdGhpcy4kZWxlbWVudC5maW5kKCcuJyArIHRoaXMuc2V0dGluZ3Muc3RhZ2VDbGFzcyk7XHJcblxyXG5cdFx0Ly8gaWYgdGhlIHN0YWdlIGlzIGFscmVhZHkgaW4gdGhlIERPTSwgZ3JhYiBpdCBhbmQgc2tpcCBzdGFnZSBpbml0aWFsaXphdGlvblxyXG5cdFx0aWYgKHRoaXMuJHN0YWdlLmxlbmd0aCkge1xyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblxyXG5cdFx0dGhpcy4kZWxlbWVudC5hZGRDbGFzcyh0aGlzLm9wdGlvbnMubG9hZGluZ0NsYXNzKTtcclxuXHJcblx0XHQvLyBjcmVhdGUgc3RhZ2VcclxuXHRcdHRoaXMuJHN0YWdlID0gJCgnPCcgKyB0aGlzLnNldHRpbmdzLnN0YWdlRWxlbWVudCArICc+Jywge1xyXG5cdFx0XHRcImNsYXNzXCI6IHRoaXMuc2V0dGluZ3Muc3RhZ2VDbGFzc1xyXG5cdFx0fSkud3JhcCggJCggJzxkaXYvPicsIHtcclxuXHRcdFx0XCJjbGFzc1wiOiB0aGlzLnNldHRpbmdzLnN0YWdlT3V0ZXJDbGFzc1xyXG5cdFx0fSkpO1xyXG5cclxuXHRcdC8vIGFwcGVuZCBzdGFnZVxyXG5cdFx0dGhpcy4kZWxlbWVudC5hcHBlbmQodGhpcy4kc3RhZ2UucGFyZW50KCkpO1xyXG5cdH07XHJcblxyXG5cdC8qKlxyXG5cdCAqIENyZWF0ZSBpdGVtIERPTSBlbGVtZW50c1xyXG5cdCAqL1xyXG5cdE93bC5wcm90b3R5cGUuaW5pdGlhbGl6ZUl0ZW1zID0gZnVuY3Rpb24oKSB7XHJcblx0XHR2YXIgJGl0ZW1zID0gdGhpcy4kZWxlbWVudC5maW5kKCcub3dsLWl0ZW0nKTtcclxuXHJcblx0XHQvLyBpZiB0aGUgaXRlbXMgYXJlIGFscmVhZHkgaW4gdGhlIERPTSwgZ3JhYiB0aGVtIGFuZCBza2lwIGl0ZW0gaW5pdGlhbGl6YXRpb25cclxuXHRcdGlmICgkaXRlbXMubGVuZ3RoKSB7XHJcblx0XHRcdHRoaXMuX2l0ZW1zID0gJGl0ZW1zLmdldCgpLm1hcChmdW5jdGlvbihpdGVtKSB7XHJcblx0XHRcdFx0cmV0dXJuICQoaXRlbSk7XHJcblx0XHRcdH0pO1xyXG5cclxuXHRcdFx0dGhpcy5fbWVyZ2VycyA9IHRoaXMuX2l0ZW1zLm1hcChmdW5jdGlvbigpIHtcclxuXHRcdFx0XHRyZXR1cm4gMTtcclxuXHRcdFx0fSk7XHJcblxyXG5cdFx0XHR0aGlzLnJlZnJlc2goKTtcclxuXHJcblx0XHRcdHJldHVybjtcclxuXHRcdH1cclxuXHJcblx0XHQvLyBhcHBlbmQgY29udGVudFxyXG5cdFx0dGhpcy5yZXBsYWNlKHRoaXMuJGVsZW1lbnQuY2hpbGRyZW4oKS5ub3QodGhpcy4kc3RhZ2UucGFyZW50KCkpKTtcclxuXHJcblx0XHQvLyBjaGVjayB2aXNpYmlsaXR5XHJcblx0XHRpZiAodGhpcy5pc1Zpc2libGUoKSkge1xyXG5cdFx0XHQvLyB1cGRhdGUgdmlld1xyXG5cdFx0XHR0aGlzLnJlZnJlc2goKTtcclxuXHRcdH0gZWxzZSB7XHJcblx0XHRcdC8vIGludmFsaWRhdGUgd2lkdGhcclxuXHRcdFx0dGhpcy5pbnZhbGlkYXRlKCd3aWR0aCcpO1xyXG5cdFx0fVxyXG5cclxuXHRcdHRoaXMuJGVsZW1lbnRcclxuXHRcdFx0LnJlbW92ZUNsYXNzKHRoaXMub3B0aW9ucy5sb2FkaW5nQ2xhc3MpXHJcblx0XHRcdC5hZGRDbGFzcyh0aGlzLm9wdGlvbnMubG9hZGVkQ2xhc3MpO1xyXG5cdH07XHJcblxyXG5cdC8qKlxyXG5cdCAqIEluaXRpYWxpemVzIHRoZSBjYXJvdXNlbC5cclxuXHQgKiBAcHJvdGVjdGVkXHJcblx0ICovXHJcblx0T3dsLnByb3RvdHlwZS5pbml0aWFsaXplID0gZnVuY3Rpb24oKSB7XHJcblx0XHR0aGlzLmVudGVyKCdpbml0aWFsaXppbmcnKTtcclxuXHRcdHRoaXMudHJpZ2dlcignaW5pdGlhbGl6ZScpO1xyXG5cclxuXHRcdHRoaXMuJGVsZW1lbnQudG9nZ2xlQ2xhc3ModGhpcy5zZXR0aW5ncy5ydGxDbGFzcywgdGhpcy5zZXR0aW5ncy5ydGwpO1xyXG5cclxuXHRcdGlmICh0aGlzLnNldHRpbmdzLmF1dG9XaWR0aCAmJiAhdGhpcy5pcygncHJlLWxvYWRpbmcnKSkge1xyXG5cdFx0XHR2YXIgaW1ncywgbmVzdGVkU2VsZWN0b3IsIHdpZHRoO1xyXG5cdFx0XHRpbWdzID0gdGhpcy4kZWxlbWVudC5maW5kKCdpbWcnKTtcclxuXHRcdFx0bmVzdGVkU2VsZWN0b3IgPSB0aGlzLnNldHRpbmdzLm5lc3RlZEl0ZW1TZWxlY3RvciA/ICcuJyArIHRoaXMuc2V0dGluZ3MubmVzdGVkSXRlbVNlbGVjdG9yIDogdW5kZWZpbmVkO1xyXG5cdFx0XHR3aWR0aCA9IHRoaXMuJGVsZW1lbnQuY2hpbGRyZW4obmVzdGVkU2VsZWN0b3IpLndpZHRoKCk7XHJcblxyXG5cdFx0XHRpZiAoaW1ncy5sZW5ndGggJiYgd2lkdGggPD0gMCkge1xyXG5cdFx0XHRcdHRoaXMucHJlbG9hZEF1dG9XaWR0aEltYWdlcyhpbWdzKTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cclxuXHRcdHRoaXMuaW5pdGlhbGl6ZVN0YWdlKCk7XHJcblx0XHR0aGlzLmluaXRpYWxpemVJdGVtcygpO1xyXG5cclxuXHRcdC8vIHJlZ2lzdGVyIGV2ZW50IGhhbmRsZXJzXHJcblx0XHR0aGlzLnJlZ2lzdGVyRXZlbnRIYW5kbGVycygpO1xyXG5cclxuXHRcdHRoaXMubGVhdmUoJ2luaXRpYWxpemluZycpO1xyXG5cdFx0dGhpcy50cmlnZ2VyKCdpbml0aWFsaXplZCcpO1xyXG5cdH07XHJcblxyXG5cdC8qKlxyXG5cdCAqIEByZXR1cm5zIHtCb29sZWFufSB2aXNpYmlsaXR5IG9mICRlbGVtZW50XHJcblx0ICogICAgICAgICAgICAgICAgICAgIGlmIHlvdSBrbm93IHRoZSBjYXJvdXNlbCB3aWxsIGFsd2F5cyBiZSB2aXNpYmxlIHlvdSBjYW4gc2V0IGBjaGVja1Zpc2liaWxpdHlgIHRvIGBmYWxzZWAgdG9cclxuXHQgKiAgICAgICAgICAgICAgICAgICAgcHJldmVudCB0aGUgZXhwZW5zaXZlIGJyb3dzZXIgbGF5b3V0IGZvcmNlZCByZWZsb3cgdGhlICRlbGVtZW50LmlzKCc6dmlzaWJsZScpIGRvZXNcclxuXHQgKi9cclxuXHRPd2wucHJvdG90eXBlLmlzVmlzaWJsZSA9IGZ1bmN0aW9uKCkge1xyXG5cdFx0cmV0dXJuIHRoaXMuc2V0dGluZ3MuY2hlY2tWaXNpYmlsaXR5XHJcblx0XHRcdD8gdGhpcy4kZWxlbWVudC5pcygnOnZpc2libGUnKVxyXG5cdFx0XHQ6IHRydWU7XHJcblx0fTtcclxuXHJcblx0LyoqXHJcblx0ICogU2V0dXBzIHRoZSBjdXJyZW50IHNldHRpbmdzLlxyXG5cdCAqIEB0b2RvIFJlbW92ZSByZXNwb25zaXZlIGNsYXNzZXMuIFdoeSBzaG91bGQgYWRhcHRpdmUgZGVzaWducyBiZSBicm91Z2h0IGludG8gSUU4P1xyXG5cdCAqIEB0b2RvIFN1cHBvcnQgZm9yIG1lZGlhIHF1ZXJpZXMgYnkgdXNpbmcgYG1hdGNoTWVkaWFgIHdvdWxkIGJlIG5pY2UuXHJcblx0ICogQHB1YmxpY1xyXG5cdCAqL1xyXG5cdE93bC5wcm90b3R5cGUuc2V0dXAgPSBmdW5jdGlvbigpIHtcclxuXHRcdHZhciB2aWV3cG9ydCA9IHRoaXMudmlld3BvcnQoKSxcclxuXHRcdFx0b3ZlcndyaXRlcyA9IHRoaXMub3B0aW9ucy5yZXNwb25zaXZlLFxyXG5cdFx0XHRtYXRjaCA9IC0xLFxyXG5cdFx0XHRzZXR0aW5ncyA9IG51bGw7XHJcblxyXG5cdFx0aWYgKCFvdmVyd3JpdGVzKSB7XHJcblx0XHRcdHNldHRpbmdzID0gJC5leHRlbmQoe30sIHRoaXMub3B0aW9ucyk7XHJcblx0XHR9IGVsc2Uge1xyXG5cdFx0XHQkLmVhY2gob3ZlcndyaXRlcywgZnVuY3Rpb24oYnJlYWtwb2ludCkge1xyXG5cdFx0XHRcdGlmIChicmVha3BvaW50IDw9IHZpZXdwb3J0ICYmIGJyZWFrcG9pbnQgPiBtYXRjaCkge1xyXG5cdFx0XHRcdFx0bWF0Y2ggPSBOdW1iZXIoYnJlYWtwb2ludCk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9KTtcclxuXHJcblx0XHRcdHNldHRpbmdzID0gJC5leHRlbmQoe30sIHRoaXMub3B0aW9ucywgb3ZlcndyaXRlc1ttYXRjaF0pO1xyXG5cdFx0XHRpZiAodHlwZW9mIHNldHRpbmdzLnN0YWdlUGFkZGluZyA9PT0gJ2Z1bmN0aW9uJykge1xyXG5cdFx0XHRcdHNldHRpbmdzLnN0YWdlUGFkZGluZyA9IHNldHRpbmdzLnN0YWdlUGFkZGluZygpO1xyXG5cdFx0XHR9XHJcblx0XHRcdGRlbGV0ZSBzZXR0aW5ncy5yZXNwb25zaXZlO1xyXG5cclxuXHRcdFx0Ly8gcmVzcG9uc2l2ZSBjbGFzc1xyXG5cdFx0XHRpZiAoc2V0dGluZ3MucmVzcG9uc2l2ZUNsYXNzKSB7XHJcblx0XHRcdFx0dGhpcy4kZWxlbWVudC5hdHRyKCdjbGFzcycsXHJcblx0XHRcdFx0XHR0aGlzLiRlbGVtZW50LmF0dHIoJ2NsYXNzJykucmVwbGFjZShuZXcgUmVnRXhwKCcoJyArIHRoaXMub3B0aW9ucy5yZXNwb25zaXZlQ2xhc3MgKyAnLSlcXFxcUytcXFxccycsICdnJyksICckMScgKyBtYXRjaClcclxuXHRcdFx0XHQpO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblxyXG5cdFx0dGhpcy50cmlnZ2VyKCdjaGFuZ2UnLCB7IHByb3BlcnR5OiB7IG5hbWU6ICdzZXR0aW5ncycsIHZhbHVlOiBzZXR0aW5ncyB9IH0pO1xyXG5cdFx0dGhpcy5fYnJlYWtwb2ludCA9IG1hdGNoO1xyXG5cdFx0dGhpcy5zZXR0aW5ncyA9IHNldHRpbmdzO1xyXG5cdFx0dGhpcy5pbnZhbGlkYXRlKCdzZXR0aW5ncycpO1xyXG5cdFx0dGhpcy50cmlnZ2VyKCdjaGFuZ2VkJywgeyBwcm9wZXJ0eTogeyBuYW1lOiAnc2V0dGluZ3MnLCB2YWx1ZTogdGhpcy5zZXR0aW5ncyB9IH0pO1xyXG5cdH07XHJcblxyXG5cdC8qKlxyXG5cdCAqIFVwZGF0ZXMgb3B0aW9uIGxvZ2ljIGlmIG5lY2Vzc2VyeS5cclxuXHQgKiBAcHJvdGVjdGVkXHJcblx0ICovXHJcblx0T3dsLnByb3RvdHlwZS5vcHRpb25zTG9naWMgPSBmdW5jdGlvbigpIHtcclxuXHRcdGlmICh0aGlzLnNldHRpbmdzLmF1dG9XaWR0aCkge1xyXG5cdFx0XHR0aGlzLnNldHRpbmdzLnN0YWdlUGFkZGluZyA9IGZhbHNlO1xyXG5cdFx0XHR0aGlzLnNldHRpbmdzLm1lcmdlID0gZmFsc2U7XHJcblx0XHR9XHJcblx0fTtcclxuXHJcblx0LyoqXHJcblx0ICogUHJlcGFyZXMgYW4gaXRlbSBiZWZvcmUgYWRkLlxyXG5cdCAqIEB0b2RvIFJlbmFtZSBldmVudCBwYXJhbWV0ZXIgYGNvbnRlbnRgIHRvIGBpdGVtYC5cclxuXHQgKiBAcHJvdGVjdGVkXHJcblx0ICogQHJldHVybnMge2pRdWVyeXxIVE1MRWxlbWVudH0gLSBUaGUgaXRlbSBjb250YWluZXIuXHJcblx0ICovXHJcblx0T3dsLnByb3RvdHlwZS5wcmVwYXJlID0gZnVuY3Rpb24oaXRlbSkge1xyXG5cdFx0dmFyIGV2ZW50ID0gdGhpcy50cmlnZ2VyKCdwcmVwYXJlJywgeyBjb250ZW50OiBpdGVtIH0pO1xyXG5cclxuXHRcdGlmICghZXZlbnQuZGF0YSkge1xyXG5cdFx0XHRldmVudC5kYXRhID0gJCgnPCcgKyB0aGlzLnNldHRpbmdzLml0ZW1FbGVtZW50ICsgJy8+JylcclxuXHRcdFx0XHQuYWRkQ2xhc3ModGhpcy5vcHRpb25zLml0ZW1DbGFzcykuYXBwZW5kKGl0ZW0pXHJcblx0XHR9XHJcblxyXG5cdFx0dGhpcy50cmlnZ2VyKCdwcmVwYXJlZCcsIHsgY29udGVudDogZXZlbnQuZGF0YSB9KTtcclxuXHJcblx0XHRyZXR1cm4gZXZlbnQuZGF0YTtcclxuXHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiBVcGRhdGVzIHRoZSB2aWV3LlxyXG5cdCAqIEBwdWJsaWNcclxuXHQgKi9cclxuXHRPd2wucHJvdG90eXBlLnVwZGF0ZSA9IGZ1bmN0aW9uKCkge1xyXG5cdFx0dmFyIGkgPSAwLFxyXG5cdFx0XHRuID0gdGhpcy5fcGlwZS5sZW5ndGgsXHJcblx0XHRcdGZpbHRlciA9ICQucHJveHkoZnVuY3Rpb24ocCkgeyByZXR1cm4gdGhpc1twXSB9LCB0aGlzLl9pbnZhbGlkYXRlZCksXHJcblx0XHRcdGNhY2hlID0ge307XHJcblxyXG5cdFx0d2hpbGUgKGkgPCBuKSB7XHJcblx0XHRcdGlmICh0aGlzLl9pbnZhbGlkYXRlZC5hbGwgfHwgJC5ncmVwKHRoaXMuX3BpcGVbaV0uZmlsdGVyLCBmaWx0ZXIpLmxlbmd0aCA+IDApIHtcclxuXHRcdFx0XHR0aGlzLl9waXBlW2ldLnJ1bihjYWNoZSk7XHJcblx0XHRcdH1cclxuXHRcdFx0aSsrO1xyXG5cdFx0fVxyXG5cclxuXHRcdHRoaXMuX2ludmFsaWRhdGVkID0ge307XHJcblxyXG5cdFx0IXRoaXMuaXMoJ3ZhbGlkJykgJiYgdGhpcy5lbnRlcigndmFsaWQnKTtcclxuXHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiBHZXRzIHRoZSB3aWR0aCBvZiB0aGUgdmlldy5cclxuXHQgKiBAcHVibGljXHJcblx0ICogQHBhcmFtIHtPd2wuV2lkdGh9IFtkaW1lbnNpb249T3dsLldpZHRoLkRlZmF1bHRdIC0gVGhlIGRpbWVuc2lvbiB0byByZXR1cm4uXHJcblx0ICogQHJldHVybnMge051bWJlcn0gLSBUaGUgd2lkdGggb2YgdGhlIHZpZXcgaW4gcGl4ZWwuXHJcblx0ICovXHJcblx0T3dsLnByb3RvdHlwZS53aWR0aCA9IGZ1bmN0aW9uKGRpbWVuc2lvbikge1xyXG5cdFx0ZGltZW5zaW9uID0gZGltZW5zaW9uIHx8IE93bC5XaWR0aC5EZWZhdWx0O1xyXG5cdFx0c3dpdGNoIChkaW1lbnNpb24pIHtcclxuXHRcdFx0Y2FzZSBPd2wuV2lkdGguSW5uZXI6XHJcblx0XHRcdGNhc2UgT3dsLldpZHRoLk91dGVyOlxyXG5cdFx0XHRcdHJldHVybiB0aGlzLl93aWR0aDtcclxuXHRcdFx0ZGVmYXVsdDpcclxuXHRcdFx0XHRyZXR1cm4gdGhpcy5fd2lkdGggLSB0aGlzLnNldHRpbmdzLnN0YWdlUGFkZGluZyAqIDIgKyB0aGlzLnNldHRpbmdzLm1hcmdpbjtcclxuXHRcdH1cclxuXHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiBSZWZyZXNoZXMgdGhlIGNhcm91c2VsIHByaW1hcmlseSBmb3IgYWRhcHRpdmUgcHVycG9zZXMuXHJcblx0ICogQHB1YmxpY1xyXG5cdCAqL1xyXG5cdE93bC5wcm90b3R5cGUucmVmcmVzaCA9IGZ1bmN0aW9uKCkge1xyXG5cdFx0dGhpcy5lbnRlcigncmVmcmVzaGluZycpO1xyXG5cdFx0dGhpcy50cmlnZ2VyKCdyZWZyZXNoJyk7XHJcblxyXG5cdFx0dGhpcy5zZXR1cCgpO1xyXG5cclxuXHRcdHRoaXMub3B0aW9uc0xvZ2ljKCk7XHJcblxyXG5cdFx0dGhpcy4kZWxlbWVudC5hZGRDbGFzcyh0aGlzLm9wdGlvbnMucmVmcmVzaENsYXNzKTtcclxuXHJcblx0XHR0aGlzLnVwZGF0ZSgpO1xyXG5cclxuXHRcdHRoaXMuJGVsZW1lbnQucmVtb3ZlQ2xhc3ModGhpcy5vcHRpb25zLnJlZnJlc2hDbGFzcyk7XHJcblxyXG5cdFx0dGhpcy5sZWF2ZSgncmVmcmVzaGluZycpO1xyXG5cdFx0dGhpcy50cmlnZ2VyKCdyZWZyZXNoZWQnKTtcclxuXHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiBDaGVja3Mgd2luZG93IGByZXNpemVgIGV2ZW50LlxyXG5cdCAqIEBwcm90ZWN0ZWRcclxuXHQgKi9cclxuXHRPd2wucHJvdG90eXBlLm9uVGhyb3R0bGVkUmVzaXplID0gZnVuY3Rpb24oKSB7XHJcblx0XHR3aW5kb3cuY2xlYXJUaW1lb3V0KHRoaXMucmVzaXplVGltZXIpO1xyXG5cdFx0dGhpcy5yZXNpemVUaW1lciA9IHdpbmRvdy5zZXRUaW1lb3V0KHRoaXMuX2hhbmRsZXJzLm9uUmVzaXplLCB0aGlzLnNldHRpbmdzLnJlc3BvbnNpdmVSZWZyZXNoUmF0ZSk7XHJcblx0fTtcclxuXHJcblx0LyoqXHJcblx0ICogQ2hlY2tzIHdpbmRvdyBgcmVzaXplYCBldmVudC5cclxuXHQgKiBAcHJvdGVjdGVkXHJcblx0ICovXHJcblx0T3dsLnByb3RvdHlwZS5vblJlc2l6ZSA9IGZ1bmN0aW9uKCkge1xyXG5cdFx0aWYgKCF0aGlzLl9pdGVtcy5sZW5ndGgpIHtcclxuXHRcdFx0cmV0dXJuIGZhbHNlO1xyXG5cdFx0fVxyXG5cclxuXHRcdGlmICh0aGlzLl93aWR0aCA9PT0gdGhpcy4kZWxlbWVudC53aWR0aCgpKSB7XHJcblx0XHRcdHJldHVybiBmYWxzZTtcclxuXHRcdH1cclxuXHJcblx0XHRpZiAoIXRoaXMuaXNWaXNpYmxlKCkpIHtcclxuXHRcdFx0cmV0dXJuIGZhbHNlO1xyXG5cdFx0fVxyXG5cclxuXHRcdHRoaXMuZW50ZXIoJ3Jlc2l6aW5nJyk7XHJcblxyXG5cdFx0aWYgKHRoaXMudHJpZ2dlcigncmVzaXplJykuaXNEZWZhdWx0UHJldmVudGVkKCkpIHtcclxuXHRcdFx0dGhpcy5sZWF2ZSgncmVzaXppbmcnKTtcclxuXHRcdFx0cmV0dXJuIGZhbHNlO1xyXG5cdFx0fVxyXG5cclxuXHRcdHRoaXMuaW52YWxpZGF0ZSgnd2lkdGgnKTtcclxuXHJcblx0XHR0aGlzLnJlZnJlc2goKTtcclxuXHJcblx0XHR0aGlzLmxlYXZlKCdyZXNpemluZycpO1xyXG5cdFx0dGhpcy50cmlnZ2VyKCdyZXNpemVkJyk7XHJcblx0fTtcclxuXHJcblx0LyoqXHJcblx0ICogUmVnaXN0ZXJzIGV2ZW50IGhhbmRsZXJzLlxyXG5cdCAqIEB0b2RvIENoZWNrIGBtc1BvaW50ZXJFbmFibGVkYFxyXG5cdCAqIEB0b2RvICMyNjFcclxuXHQgKiBAcHJvdGVjdGVkXHJcblx0ICovXHJcblx0T3dsLnByb3RvdHlwZS5yZWdpc3RlckV2ZW50SGFuZGxlcnMgPSBmdW5jdGlvbigpIHtcclxuXHRcdGlmICgkLnN1cHBvcnQudHJhbnNpdGlvbikge1xyXG5cdFx0XHR0aGlzLiRzdGFnZS5vbigkLnN1cHBvcnQudHJhbnNpdGlvbi5lbmQgKyAnLm93bC5jb3JlJywgJC5wcm94eSh0aGlzLm9uVHJhbnNpdGlvbkVuZCwgdGhpcykpO1xyXG5cdFx0fVxyXG5cclxuXHRcdGlmICh0aGlzLnNldHRpbmdzLnJlc3BvbnNpdmUgIT09IGZhbHNlKSB7XHJcblx0XHRcdHRoaXMub24od2luZG93LCAncmVzaXplJywgdGhpcy5faGFuZGxlcnMub25UaHJvdHRsZWRSZXNpemUpO1xyXG5cdFx0fVxyXG5cclxuXHRcdGlmICh0aGlzLnNldHRpbmdzLm1vdXNlRHJhZykge1xyXG5cdFx0XHR0aGlzLiRlbGVtZW50LmFkZENsYXNzKHRoaXMub3B0aW9ucy5kcmFnQ2xhc3MpO1xyXG5cdFx0XHR0aGlzLiRzdGFnZS5vbignbW91c2Vkb3duLm93bC5jb3JlJywgJC5wcm94eSh0aGlzLm9uRHJhZ1N0YXJ0LCB0aGlzKSk7XHJcblx0XHRcdHRoaXMuJHN0YWdlLm9uKCdkcmFnc3RhcnQub3dsLmNvcmUgc2VsZWN0c3RhcnQub3dsLmNvcmUnLCBmdW5jdGlvbigpIHsgcmV0dXJuIGZhbHNlIH0pO1xyXG5cdFx0fVxyXG5cclxuXHRcdGlmICh0aGlzLnNldHRpbmdzLnRvdWNoRHJhZyl7XHJcblx0XHRcdHRoaXMuJHN0YWdlLm9uKCd0b3VjaHN0YXJ0Lm93bC5jb3JlJywgJC5wcm94eSh0aGlzLm9uRHJhZ1N0YXJ0LCB0aGlzKSk7XHJcblx0XHRcdHRoaXMuJHN0YWdlLm9uKCd0b3VjaGNhbmNlbC5vd2wuY29yZScsICQucHJveHkodGhpcy5vbkRyYWdFbmQsIHRoaXMpKTtcclxuXHRcdH1cclxuXHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiBIYW5kbGVzIGB0b3VjaHN0YXJ0YCBhbmQgYG1vdXNlZG93bmAgZXZlbnRzLlxyXG5cdCAqIEB0b2RvIEhvcml6b250YWwgc3dpcGUgdGhyZXNob2xkIGFzIG9wdGlvblxyXG5cdCAqIEB0b2RvICMyNjFcclxuXHQgKiBAcHJvdGVjdGVkXHJcblx0ICogQHBhcmFtIHtFdmVudH0gZXZlbnQgLSBUaGUgZXZlbnQgYXJndW1lbnRzLlxyXG5cdCAqL1xyXG5cdE93bC5wcm90b3R5cGUub25EcmFnU3RhcnQgPSBmdW5jdGlvbihldmVudCkge1xyXG5cdFx0dmFyIHN0YWdlID0gbnVsbDtcclxuXHJcblx0XHRpZiAoZXZlbnQud2hpY2ggPT09IDMpIHtcclxuXHRcdFx0cmV0dXJuO1xyXG5cdFx0fVxyXG5cclxuXHRcdGlmICgkLnN1cHBvcnQudHJhbnNmb3JtKSB7XHJcblx0XHRcdHN0YWdlID0gdGhpcy4kc3RhZ2UuY3NzKCd0cmFuc2Zvcm0nKS5yZXBsYWNlKC8uKlxcKHxcXCl8IC9nLCAnJykuc3BsaXQoJywnKTtcclxuXHRcdFx0c3RhZ2UgPSB7XHJcblx0XHRcdFx0eDogc3RhZ2Vbc3RhZ2UubGVuZ3RoID09PSAxNiA/IDEyIDogNF0sXHJcblx0XHRcdFx0eTogc3RhZ2Vbc3RhZ2UubGVuZ3RoID09PSAxNiA/IDEzIDogNV1cclxuXHRcdFx0fTtcclxuXHRcdH0gZWxzZSB7XHJcblx0XHRcdHN0YWdlID0gdGhpcy4kc3RhZ2UucG9zaXRpb24oKTtcclxuXHRcdFx0c3RhZ2UgPSB7XHJcblx0XHRcdFx0eDogdGhpcy5zZXR0aW5ncy5ydGwgP1xyXG5cdFx0XHRcdFx0c3RhZ2UubGVmdCArIHRoaXMuJHN0YWdlLndpZHRoKCkgLSB0aGlzLndpZHRoKCkgKyB0aGlzLnNldHRpbmdzLm1hcmdpbiA6XHJcblx0XHRcdFx0XHRzdGFnZS5sZWZ0LFxyXG5cdFx0XHRcdHk6IHN0YWdlLnRvcFxyXG5cdFx0XHR9O1xyXG5cdFx0fVxyXG5cclxuXHRcdGlmICh0aGlzLmlzKCdhbmltYXRpbmcnKSkge1xyXG5cdFx0XHQkLnN1cHBvcnQudHJhbnNmb3JtID8gdGhpcy5hbmltYXRlKHN0YWdlLngpIDogdGhpcy4kc3RhZ2Uuc3RvcCgpXHJcblx0XHRcdHRoaXMuaW52YWxpZGF0ZSgncG9zaXRpb24nKTtcclxuXHRcdH1cclxuXHJcblx0XHR0aGlzLiRlbGVtZW50LnRvZ2dsZUNsYXNzKHRoaXMub3B0aW9ucy5ncmFiQ2xhc3MsIGV2ZW50LnR5cGUgPT09ICdtb3VzZWRvd24nKTtcclxuXHJcblx0XHR0aGlzLnNwZWVkKDApO1xyXG5cclxuXHRcdHRoaXMuX2RyYWcudGltZSA9IG5ldyBEYXRlKCkuZ2V0VGltZSgpO1xyXG5cdFx0dGhpcy5fZHJhZy50YXJnZXQgPSAkKGV2ZW50LnRhcmdldCk7XHJcblx0XHR0aGlzLl9kcmFnLnN0YWdlLnN0YXJ0ID0gc3RhZ2U7XHJcblx0XHR0aGlzLl9kcmFnLnN0YWdlLmN1cnJlbnQgPSBzdGFnZTtcclxuXHRcdHRoaXMuX2RyYWcucG9pbnRlciA9IHRoaXMucG9pbnRlcihldmVudCk7XHJcblxyXG5cdFx0JChkb2N1bWVudCkub24oJ21vdXNldXAub3dsLmNvcmUgdG91Y2hlbmQub3dsLmNvcmUnLCAkLnByb3h5KHRoaXMub25EcmFnRW5kLCB0aGlzKSk7XHJcblxyXG5cdFx0JChkb2N1bWVudCkub25lKCdtb3VzZW1vdmUub3dsLmNvcmUgdG91Y2htb3ZlLm93bC5jb3JlJywgJC5wcm94eShmdW5jdGlvbihldmVudCkge1xyXG5cdFx0XHR2YXIgZGVsdGEgPSB0aGlzLmRpZmZlcmVuY2UodGhpcy5fZHJhZy5wb2ludGVyLCB0aGlzLnBvaW50ZXIoZXZlbnQpKTtcclxuXHJcblx0XHRcdCQoZG9jdW1lbnQpLm9uKCdtb3VzZW1vdmUub3dsLmNvcmUgdG91Y2htb3ZlLm93bC5jb3JlJywgJC5wcm94eSh0aGlzLm9uRHJhZ01vdmUsIHRoaXMpKTtcclxuXHJcblx0XHRcdGlmIChNYXRoLmFicyhkZWx0YS54KSA8IE1hdGguYWJzKGRlbHRhLnkpICYmIHRoaXMuaXMoJ3ZhbGlkJykpIHtcclxuXHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XHJcblxyXG5cdFx0XHR0aGlzLmVudGVyKCdkcmFnZ2luZycpO1xyXG5cdFx0XHR0aGlzLnRyaWdnZXIoJ2RyYWcnKTtcclxuXHRcdH0sIHRoaXMpKTtcclxuXHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiBIYW5kbGVzIHRoZSBgdG91Y2htb3ZlYCBhbmQgYG1vdXNlbW92ZWAgZXZlbnRzLlxyXG5cdCAqIEB0b2RvICMyNjFcclxuXHQgKiBAcHJvdGVjdGVkXHJcblx0ICogQHBhcmFtIHtFdmVudH0gZXZlbnQgLSBUaGUgZXZlbnQgYXJndW1lbnRzLlxyXG5cdCAqL1xyXG5cdE93bC5wcm90b3R5cGUub25EcmFnTW92ZSA9IGZ1bmN0aW9uKGV2ZW50KSB7XHJcblx0XHR2YXIgbWluaW11bSA9IG51bGwsXHJcblx0XHRcdG1heGltdW0gPSBudWxsLFxyXG5cdFx0XHRwdWxsID0gbnVsbCxcclxuXHRcdFx0ZGVsdGEgPSB0aGlzLmRpZmZlcmVuY2UodGhpcy5fZHJhZy5wb2ludGVyLCB0aGlzLnBvaW50ZXIoZXZlbnQpKSxcclxuXHRcdFx0c3RhZ2UgPSB0aGlzLmRpZmZlcmVuY2UodGhpcy5fZHJhZy5zdGFnZS5zdGFydCwgZGVsdGEpO1xyXG5cclxuXHRcdGlmICghdGhpcy5pcygnZHJhZ2dpbmcnKSkge1xyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblxyXG5cdFx0ZXZlbnQucHJldmVudERlZmF1bHQoKTtcclxuXHJcblx0XHRpZiAodGhpcy5zZXR0aW5ncy5sb29wKSB7XHJcblx0XHRcdG1pbmltdW0gPSB0aGlzLmNvb3JkaW5hdGVzKHRoaXMubWluaW11bSgpKTtcclxuXHRcdFx0bWF4aW11bSA9IHRoaXMuY29vcmRpbmF0ZXModGhpcy5tYXhpbXVtKCkgKyAxKSAtIG1pbmltdW07XHJcblx0XHRcdHN0YWdlLnggPSAoKChzdGFnZS54IC0gbWluaW11bSkgJSBtYXhpbXVtICsgbWF4aW11bSkgJSBtYXhpbXVtKSArIG1pbmltdW07XHJcblx0XHR9IGVsc2Uge1xyXG5cdFx0XHRtaW5pbXVtID0gdGhpcy5zZXR0aW5ncy5ydGwgPyB0aGlzLmNvb3JkaW5hdGVzKHRoaXMubWF4aW11bSgpKSA6IHRoaXMuY29vcmRpbmF0ZXModGhpcy5taW5pbXVtKCkpO1xyXG5cdFx0XHRtYXhpbXVtID0gdGhpcy5zZXR0aW5ncy5ydGwgPyB0aGlzLmNvb3JkaW5hdGVzKHRoaXMubWluaW11bSgpKSA6IHRoaXMuY29vcmRpbmF0ZXModGhpcy5tYXhpbXVtKCkpO1xyXG5cdFx0XHRwdWxsID0gdGhpcy5zZXR0aW5ncy5wdWxsRHJhZyA/IC0xICogZGVsdGEueCAvIDUgOiAwO1xyXG5cdFx0XHRzdGFnZS54ID0gTWF0aC5tYXgoTWF0aC5taW4oc3RhZ2UueCwgbWluaW11bSArIHB1bGwpLCBtYXhpbXVtICsgcHVsbCk7XHJcblx0XHR9XHJcblxyXG5cdFx0dGhpcy5fZHJhZy5zdGFnZS5jdXJyZW50ID0gc3RhZ2U7XHJcblxyXG5cdFx0dGhpcy5hbmltYXRlKHN0YWdlLngpO1xyXG5cdH07XHJcblxyXG5cdC8qKlxyXG5cdCAqIEhhbmRsZXMgdGhlIGB0b3VjaGVuZGAgYW5kIGBtb3VzZXVwYCBldmVudHMuXHJcblx0ICogQHRvZG8gIzI2MVxyXG5cdCAqIEB0b2RvIFRocmVzaG9sZCBmb3IgY2xpY2sgZXZlbnRcclxuXHQgKiBAcHJvdGVjdGVkXHJcblx0ICogQHBhcmFtIHtFdmVudH0gZXZlbnQgLSBUaGUgZXZlbnQgYXJndW1lbnRzLlxyXG5cdCAqL1xyXG5cdE93bC5wcm90b3R5cGUub25EcmFnRW5kID0gZnVuY3Rpb24oZXZlbnQpIHtcclxuXHRcdHZhciBkZWx0YSA9IHRoaXMuZGlmZmVyZW5jZSh0aGlzLl9kcmFnLnBvaW50ZXIsIHRoaXMucG9pbnRlcihldmVudCkpLFxyXG5cdFx0XHRzdGFnZSA9IHRoaXMuX2RyYWcuc3RhZ2UuY3VycmVudCxcclxuXHRcdFx0ZGlyZWN0aW9uID0gZGVsdGEueCA+IDAgXiB0aGlzLnNldHRpbmdzLnJ0bCA/ICdsZWZ0JyA6ICdyaWdodCc7XHJcblxyXG5cdFx0JChkb2N1bWVudCkub2ZmKCcub3dsLmNvcmUnKTtcclxuXHJcblx0XHR0aGlzLiRlbGVtZW50LnJlbW92ZUNsYXNzKHRoaXMub3B0aW9ucy5ncmFiQ2xhc3MpO1xyXG5cclxuXHRcdGlmIChkZWx0YS54ICE9PSAwICYmIHRoaXMuaXMoJ2RyYWdnaW5nJykgfHwgIXRoaXMuaXMoJ3ZhbGlkJykpIHtcclxuXHRcdFx0dGhpcy5zcGVlZCh0aGlzLnNldHRpbmdzLmRyYWdFbmRTcGVlZCB8fCB0aGlzLnNldHRpbmdzLnNtYXJ0U3BlZWQpO1xyXG5cdFx0XHR0aGlzLmN1cnJlbnQodGhpcy5jbG9zZXN0KHN0YWdlLngsIGRlbHRhLnggIT09IDAgPyBkaXJlY3Rpb24gOiB0aGlzLl9kcmFnLmRpcmVjdGlvbikpO1xyXG5cdFx0XHR0aGlzLmludmFsaWRhdGUoJ3Bvc2l0aW9uJyk7XHJcblx0XHRcdHRoaXMudXBkYXRlKCk7XHJcblxyXG5cdFx0XHR0aGlzLl9kcmFnLmRpcmVjdGlvbiA9IGRpcmVjdGlvbjtcclxuXHJcblx0XHRcdGlmIChNYXRoLmFicyhkZWx0YS54KSA+IDMgfHwgbmV3IERhdGUoKS5nZXRUaW1lKCkgLSB0aGlzLl9kcmFnLnRpbWUgPiAzMDApIHtcclxuXHRcdFx0XHR0aGlzLl9kcmFnLnRhcmdldC5vbmUoJ2NsaWNrLm93bC5jb3JlJywgZnVuY3Rpb24oKSB7IHJldHVybiBmYWxzZTsgfSk7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHJcblx0XHRpZiAoIXRoaXMuaXMoJ2RyYWdnaW5nJykpIHtcclxuXHRcdFx0cmV0dXJuO1xyXG5cdFx0fVxyXG5cclxuXHRcdHRoaXMubGVhdmUoJ2RyYWdnaW5nJyk7XHJcblx0XHR0aGlzLnRyaWdnZXIoJ2RyYWdnZWQnKTtcclxuXHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiBHZXRzIGFic29sdXRlIHBvc2l0aW9uIG9mIHRoZSBjbG9zZXN0IGl0ZW0gZm9yIGEgY29vcmRpbmF0ZS5cclxuXHQgKiBAdG9kbyBTZXR0aW5nIGBmcmVlRHJhZ2AgbWFrZXMgYGNsb3Nlc3RgIG5vdCByZXVzYWJsZS4gU2VlICMxNjUuXHJcblx0ICogQHByb3RlY3RlZFxyXG5cdCAqIEBwYXJhbSB7TnVtYmVyfSBjb29yZGluYXRlIC0gVGhlIGNvb3JkaW5hdGUgaW4gcGl4ZWwuXHJcblx0ICogQHBhcmFtIHtTdHJpbmd9IGRpcmVjdGlvbiAtIFRoZSBkaXJlY3Rpb24gdG8gY2hlY2sgZm9yIHRoZSBjbG9zZXN0IGl0ZW0uIEV0aGVyIGBsZWZ0YCBvciBgcmlnaHRgLlxyXG5cdCAqIEByZXR1cm4ge051bWJlcn0gLSBUaGUgYWJzb2x1dGUgcG9zaXRpb24gb2YgdGhlIGNsb3Nlc3QgaXRlbS5cclxuXHQgKi9cclxuXHRPd2wucHJvdG90eXBlLmNsb3Nlc3QgPSBmdW5jdGlvbihjb29yZGluYXRlLCBkaXJlY3Rpb24pIHtcclxuXHRcdHZhciBwb3NpdGlvbiA9IC0xLFxyXG5cdFx0XHRwdWxsID0gMzAsXHJcblx0XHRcdHdpZHRoID0gdGhpcy53aWR0aCgpLFxyXG5cdFx0XHRjb29yZGluYXRlcyA9IHRoaXMuY29vcmRpbmF0ZXMoKTtcclxuXHJcblx0XHRpZiAoIXRoaXMuc2V0dGluZ3MuZnJlZURyYWcpIHtcclxuXHRcdFx0Ly8gY2hlY2sgY2xvc2VzdCBpdGVtXHJcblx0XHRcdCQuZWFjaChjb29yZGluYXRlcywgJC5wcm94eShmdW5jdGlvbihpbmRleCwgdmFsdWUpIHtcclxuXHRcdFx0XHQvLyBvbiBhIGxlZnQgcHVsbCwgY2hlY2sgb24gY3VycmVudCBpbmRleFxyXG5cdFx0XHRcdGlmIChkaXJlY3Rpb24gPT09ICdsZWZ0JyAmJiBjb29yZGluYXRlID4gdmFsdWUgLSBwdWxsICYmIGNvb3JkaW5hdGUgPCB2YWx1ZSArIHB1bGwpIHtcclxuXHRcdFx0XHRcdHBvc2l0aW9uID0gaW5kZXg7XHJcblx0XHRcdFx0Ly8gb24gYSByaWdodCBwdWxsLCBjaGVjayBvbiBwcmV2aW91cyBpbmRleFxyXG5cdFx0XHRcdC8vIHRvIGRvIHNvLCBzdWJ0cmFjdCB3aWR0aCBmcm9tIHZhbHVlIGFuZCBzZXQgcG9zaXRpb24gPSBpbmRleCArIDFcclxuXHRcdFx0XHR9IGVsc2UgaWYgKGRpcmVjdGlvbiA9PT0gJ3JpZ2h0JyAmJiBjb29yZGluYXRlID4gdmFsdWUgLSB3aWR0aCAtIHB1bGwgJiYgY29vcmRpbmF0ZSA8IHZhbHVlIC0gd2lkdGggKyBwdWxsKSB7XHJcblx0XHRcdFx0XHRwb3NpdGlvbiA9IGluZGV4ICsgMTtcclxuXHRcdFx0XHR9IGVsc2UgaWYgKHRoaXMub3AoY29vcmRpbmF0ZSwgJzwnLCB2YWx1ZSlcclxuXHRcdFx0XHRcdCYmIHRoaXMub3AoY29vcmRpbmF0ZSwgJz4nLCBjb29yZGluYXRlc1tpbmRleCArIDFdICE9PSB1bmRlZmluZWQgPyBjb29yZGluYXRlc1tpbmRleCArIDFdIDogdmFsdWUgLSB3aWR0aCkpIHtcclxuXHRcdFx0XHRcdHBvc2l0aW9uID0gZGlyZWN0aW9uID09PSAnbGVmdCcgPyBpbmRleCArIDEgOiBpbmRleDtcclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0cmV0dXJuIHBvc2l0aW9uID09PSAtMTtcclxuXHRcdFx0fSwgdGhpcykpO1xyXG5cdFx0fVxyXG5cclxuXHRcdGlmICghdGhpcy5zZXR0aW5ncy5sb29wKSB7XHJcblx0XHRcdC8vIG5vbiBsb29wIGJvdW5kcmllc1xyXG5cdFx0XHRpZiAodGhpcy5vcChjb29yZGluYXRlLCAnPicsIGNvb3JkaW5hdGVzW3RoaXMubWluaW11bSgpXSkpIHtcclxuXHRcdFx0XHRwb3NpdGlvbiA9IGNvb3JkaW5hdGUgPSB0aGlzLm1pbmltdW0oKTtcclxuXHRcdFx0fSBlbHNlIGlmICh0aGlzLm9wKGNvb3JkaW5hdGUsICc8JywgY29vcmRpbmF0ZXNbdGhpcy5tYXhpbXVtKCldKSkge1xyXG5cdFx0XHRcdHBvc2l0aW9uID0gY29vcmRpbmF0ZSA9IHRoaXMubWF4aW11bSgpO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblxyXG5cdFx0cmV0dXJuIHBvc2l0aW9uO1xyXG5cdH07XHJcblxyXG5cdC8qKlxyXG5cdCAqIEFuaW1hdGVzIHRoZSBzdGFnZS5cclxuXHQgKiBAdG9kbyAjMjcwXHJcblx0ICogQHB1YmxpY1xyXG5cdCAqIEBwYXJhbSB7TnVtYmVyfSBjb29yZGluYXRlIC0gVGhlIGNvb3JkaW5hdGUgaW4gcGl4ZWxzLlxyXG5cdCAqL1xyXG5cdE93bC5wcm90b3R5cGUuYW5pbWF0ZSA9IGZ1bmN0aW9uKGNvb3JkaW5hdGUpIHtcclxuXHRcdHZhciBhbmltYXRlID0gdGhpcy5zcGVlZCgpID4gMDtcclxuXHJcblx0XHR0aGlzLmlzKCdhbmltYXRpbmcnKSAmJiB0aGlzLm9uVHJhbnNpdGlvbkVuZCgpO1xyXG5cclxuXHRcdGlmIChhbmltYXRlKSB7XHJcblx0XHRcdHRoaXMuZW50ZXIoJ2FuaW1hdGluZycpO1xyXG5cdFx0XHR0aGlzLnRyaWdnZXIoJ3RyYW5zbGF0ZScpO1xyXG5cdFx0fVxyXG5cclxuXHRcdGlmICgkLnN1cHBvcnQudHJhbnNmb3JtM2QgJiYgJC5zdXBwb3J0LnRyYW5zaXRpb24pIHtcclxuXHRcdFx0dGhpcy4kc3RhZ2UuY3NzKHtcclxuXHRcdFx0XHR0cmFuc2Zvcm06ICd0cmFuc2xhdGUzZCgnICsgY29vcmRpbmF0ZSArICdweCwwcHgsMHB4KScsXHJcblx0XHRcdFx0dHJhbnNpdGlvbjogKHRoaXMuc3BlZWQoKSAvIDEwMDApICsgJ3MnICsgKFxyXG5cdFx0XHRcdFx0dGhpcy5zZXR0aW5ncy5zbGlkZVRyYW5zaXRpb24gPyAnICcgKyB0aGlzLnNldHRpbmdzLnNsaWRlVHJhbnNpdGlvbiA6ICcnXHJcblx0XHRcdFx0KVxyXG5cdFx0XHR9KTtcclxuXHRcdH0gZWxzZSBpZiAoYW5pbWF0ZSkge1xyXG5cdFx0XHR0aGlzLiRzdGFnZS5hbmltYXRlKHtcclxuXHRcdFx0XHRsZWZ0OiBjb29yZGluYXRlICsgJ3B4J1xyXG5cdFx0XHR9LCB0aGlzLnNwZWVkKCksIHRoaXMuc2V0dGluZ3MuZmFsbGJhY2tFYXNpbmcsICQucHJveHkodGhpcy5vblRyYW5zaXRpb25FbmQsIHRoaXMpKTtcclxuXHRcdH0gZWxzZSB7XHJcblx0XHRcdHRoaXMuJHN0YWdlLmNzcyh7XHJcblx0XHRcdFx0bGVmdDogY29vcmRpbmF0ZSArICdweCdcclxuXHRcdFx0fSk7XHJcblx0XHR9XHJcblx0fTtcclxuXHJcblx0LyoqXHJcblx0ICogQ2hlY2tzIHdoZXRoZXIgdGhlIGNhcm91c2VsIGlzIGluIGEgc3BlY2lmaWMgc3RhdGUgb3Igbm90LlxyXG5cdCAqIEBwYXJhbSB7U3RyaW5nfSBzdGF0ZSAtIFRoZSBzdGF0ZSB0byBjaGVjay5cclxuXHQgKiBAcmV0dXJucyB7Qm9vbGVhbn0gLSBUaGUgZmxhZyB3aGljaCBpbmRpY2F0ZXMgaWYgdGhlIGNhcm91c2VsIGlzIGJ1c3kuXHJcblx0ICovXHJcblx0T3dsLnByb3RvdHlwZS5pcyA9IGZ1bmN0aW9uKHN0YXRlKSB7XHJcblx0XHRyZXR1cm4gdGhpcy5fc3RhdGVzLmN1cnJlbnRbc3RhdGVdICYmIHRoaXMuX3N0YXRlcy5jdXJyZW50W3N0YXRlXSA+IDA7XHJcblx0fTtcclxuXHJcblx0LyoqXHJcblx0ICogU2V0cyB0aGUgYWJzb2x1dGUgcG9zaXRpb24gb2YgdGhlIGN1cnJlbnQgaXRlbS5cclxuXHQgKiBAcHVibGljXHJcblx0ICogQHBhcmFtIHtOdW1iZXJ9IFtwb3NpdGlvbl0gLSBUaGUgbmV3IGFic29sdXRlIHBvc2l0aW9uIG9yIG5vdGhpbmcgdG8gbGVhdmUgaXQgdW5jaGFuZ2VkLlxyXG5cdCAqIEByZXR1cm5zIHtOdW1iZXJ9IC0gVGhlIGFic29sdXRlIHBvc2l0aW9uIG9mIHRoZSBjdXJyZW50IGl0ZW0uXHJcblx0ICovXHJcblx0T3dsLnByb3RvdHlwZS5jdXJyZW50ID0gZnVuY3Rpb24ocG9zaXRpb24pIHtcclxuXHRcdGlmIChwb3NpdGlvbiA9PT0gdW5kZWZpbmVkKSB7XHJcblx0XHRcdHJldHVybiB0aGlzLl9jdXJyZW50O1xyXG5cdFx0fVxyXG5cclxuXHRcdGlmICh0aGlzLl9pdGVtcy5sZW5ndGggPT09IDApIHtcclxuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcclxuXHRcdH1cclxuXHJcblx0XHRwb3NpdGlvbiA9IHRoaXMubm9ybWFsaXplKHBvc2l0aW9uKTtcclxuXHJcblx0XHRpZiAodGhpcy5fY3VycmVudCAhPT0gcG9zaXRpb24pIHtcclxuXHRcdFx0dmFyIGV2ZW50ID0gdGhpcy50cmlnZ2VyKCdjaGFuZ2UnLCB7IHByb3BlcnR5OiB7IG5hbWU6ICdwb3NpdGlvbicsIHZhbHVlOiBwb3NpdGlvbiB9IH0pO1xyXG5cclxuXHRcdFx0aWYgKGV2ZW50LmRhdGEgIT09IHVuZGVmaW5lZCkge1xyXG5cdFx0XHRcdHBvc2l0aW9uID0gdGhpcy5ub3JtYWxpemUoZXZlbnQuZGF0YSk7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdHRoaXMuX2N1cnJlbnQgPSBwb3NpdGlvbjtcclxuXHJcblx0XHRcdHRoaXMuaW52YWxpZGF0ZSgncG9zaXRpb24nKTtcclxuXHJcblx0XHRcdHRoaXMudHJpZ2dlcignY2hhbmdlZCcsIHsgcHJvcGVydHk6IHsgbmFtZTogJ3Bvc2l0aW9uJywgdmFsdWU6IHRoaXMuX2N1cnJlbnQgfSB9KTtcclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4gdGhpcy5fY3VycmVudDtcclxuXHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiBJbnZhbGlkYXRlcyB0aGUgZ2l2ZW4gcGFydCBvZiB0aGUgdXBkYXRlIHJvdXRpbmUuXHJcblx0ICogQHBhcmFtIHtTdHJpbmd9IFtwYXJ0XSAtIFRoZSBwYXJ0IHRvIGludmFsaWRhdGUuXHJcblx0ICogQHJldHVybnMge0FycmF5LjxTdHJpbmc+fSAtIFRoZSBpbnZhbGlkYXRlZCBwYXJ0cy5cclxuXHQgKi9cclxuXHRPd2wucHJvdG90eXBlLmludmFsaWRhdGUgPSBmdW5jdGlvbihwYXJ0KSB7XHJcblx0XHRpZiAoJC50eXBlKHBhcnQpID09PSAnc3RyaW5nJykge1xyXG5cdFx0XHR0aGlzLl9pbnZhbGlkYXRlZFtwYXJ0XSA9IHRydWU7XHJcblx0XHRcdHRoaXMuaXMoJ3ZhbGlkJykgJiYgdGhpcy5sZWF2ZSgndmFsaWQnKTtcclxuXHRcdH1cclxuXHRcdHJldHVybiAkLm1hcCh0aGlzLl9pbnZhbGlkYXRlZCwgZnVuY3Rpb24odiwgaSkgeyByZXR1cm4gaSB9KTtcclxuXHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiBSZXNldHMgdGhlIGFic29sdXRlIHBvc2l0aW9uIG9mIHRoZSBjdXJyZW50IGl0ZW0uXHJcblx0ICogQHB1YmxpY1xyXG5cdCAqIEBwYXJhbSB7TnVtYmVyfSBwb3NpdGlvbiAtIFRoZSBhYnNvbHV0ZSBwb3NpdGlvbiBvZiB0aGUgbmV3IGl0ZW0uXHJcblx0ICovXHJcblx0T3dsLnByb3RvdHlwZS5yZXNldCA9IGZ1bmN0aW9uKHBvc2l0aW9uKSB7XHJcblx0XHRwb3NpdGlvbiA9IHRoaXMubm9ybWFsaXplKHBvc2l0aW9uKTtcclxuXHJcblx0XHRpZiAocG9zaXRpb24gPT09IHVuZGVmaW5lZCkge1xyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblxyXG5cdFx0dGhpcy5fc3BlZWQgPSAwO1xyXG5cdFx0dGhpcy5fY3VycmVudCA9IHBvc2l0aW9uO1xyXG5cclxuXHRcdHRoaXMuc3VwcHJlc3MoWyAndHJhbnNsYXRlJywgJ3RyYW5zbGF0ZWQnIF0pO1xyXG5cclxuXHRcdHRoaXMuYW5pbWF0ZSh0aGlzLmNvb3JkaW5hdGVzKHBvc2l0aW9uKSk7XHJcblxyXG5cdFx0dGhpcy5yZWxlYXNlKFsgJ3RyYW5zbGF0ZScsICd0cmFuc2xhdGVkJyBdKTtcclxuXHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiBOb3JtYWxpemVzIGFuIGFic29sdXRlIG9yIGEgcmVsYXRpdmUgcG9zaXRpb24gb2YgYW4gaXRlbS5cclxuXHQgKiBAcHVibGljXHJcblx0ICogQHBhcmFtIHtOdW1iZXJ9IHBvc2l0aW9uIC0gVGhlIGFic29sdXRlIG9yIHJlbGF0aXZlIHBvc2l0aW9uIHRvIG5vcm1hbGl6ZS5cclxuXHQgKiBAcGFyYW0ge0Jvb2xlYW59IFtyZWxhdGl2ZT1mYWxzZV0gLSBXaGV0aGVyIHRoZSBnaXZlbiBwb3NpdGlvbiBpcyByZWxhdGl2ZSBvciBub3QuXHJcblx0ICogQHJldHVybnMge051bWJlcn0gLSBUaGUgbm9ybWFsaXplZCBwb3NpdGlvbi5cclxuXHQgKi9cclxuXHRPd2wucHJvdG90eXBlLm5vcm1hbGl6ZSA9IGZ1bmN0aW9uKHBvc2l0aW9uLCByZWxhdGl2ZSkge1xyXG5cdFx0dmFyIG4gPSB0aGlzLl9pdGVtcy5sZW5ndGgsXHJcblx0XHRcdG0gPSByZWxhdGl2ZSA/IDAgOiB0aGlzLl9jbG9uZXMubGVuZ3RoO1xyXG5cclxuXHRcdGlmICghdGhpcy5pc051bWVyaWMocG9zaXRpb24pIHx8IG4gPCAxKSB7XHJcblx0XHRcdHBvc2l0aW9uID0gdW5kZWZpbmVkO1xyXG5cdFx0fSBlbHNlIGlmIChwb3NpdGlvbiA8IDAgfHwgcG9zaXRpb24gPj0gbiArIG0pIHtcclxuXHRcdFx0cG9zaXRpb24gPSAoKHBvc2l0aW9uIC0gbSAvIDIpICUgbiArIG4pICUgbiArIG0gLyAyO1xyXG5cdFx0fVxyXG5cclxuXHRcdHJldHVybiBwb3NpdGlvbjtcclxuXHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiBDb252ZXJ0cyBhbiBhYnNvbHV0ZSBwb3NpdGlvbiBvZiBhbiBpdGVtIGludG8gYSByZWxhdGl2ZSBvbmUuXHJcblx0ICogQHB1YmxpY1xyXG5cdCAqIEBwYXJhbSB7TnVtYmVyfSBwb3NpdGlvbiAtIFRoZSBhYnNvbHV0ZSBwb3NpdGlvbiB0byBjb252ZXJ0LlxyXG5cdCAqIEByZXR1cm5zIHtOdW1iZXJ9IC0gVGhlIGNvbnZlcnRlZCBwb3NpdGlvbi5cclxuXHQgKi9cclxuXHRPd2wucHJvdG90eXBlLnJlbGF0aXZlID0gZnVuY3Rpb24ocG9zaXRpb24pIHtcclxuXHRcdHBvc2l0aW9uIC09IHRoaXMuX2Nsb25lcy5sZW5ndGggLyAyO1xyXG5cdFx0cmV0dXJuIHRoaXMubm9ybWFsaXplKHBvc2l0aW9uLCB0cnVlKTtcclxuXHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiBHZXRzIHRoZSBtYXhpbXVtIHBvc2l0aW9uIGZvciB0aGUgY3VycmVudCBpdGVtLlxyXG5cdCAqIEBwdWJsaWNcclxuXHQgKiBAcGFyYW0ge0Jvb2xlYW59IFtyZWxhdGl2ZT1mYWxzZV0gLSBXaGV0aGVyIHRvIHJldHVybiBhbiBhYnNvbHV0ZSBwb3NpdGlvbiBvciBhIHJlbGF0aXZlIHBvc2l0aW9uLlxyXG5cdCAqIEByZXR1cm5zIHtOdW1iZXJ9XHJcblx0ICovXHJcblx0T3dsLnByb3RvdHlwZS5tYXhpbXVtID0gZnVuY3Rpb24ocmVsYXRpdmUpIHtcclxuXHRcdHZhciBzZXR0aW5ncyA9IHRoaXMuc2V0dGluZ3MsXHJcblx0XHRcdG1heGltdW0gPSB0aGlzLl9jb29yZGluYXRlcy5sZW5ndGgsXHJcblx0XHRcdGl0ZXJhdG9yLFxyXG5cdFx0XHRyZWNpcHJvY2FsSXRlbXNXaWR0aCxcclxuXHRcdFx0ZWxlbWVudFdpZHRoO1xyXG5cclxuXHRcdGlmIChzZXR0aW5ncy5sb29wKSB7XHJcblx0XHRcdG1heGltdW0gPSB0aGlzLl9jbG9uZXMubGVuZ3RoIC8gMiArIHRoaXMuX2l0ZW1zLmxlbmd0aCAtIDE7XHJcblx0XHR9IGVsc2UgaWYgKHNldHRpbmdzLmF1dG9XaWR0aCB8fCBzZXR0aW5ncy5tZXJnZSkge1xyXG5cdFx0XHRpdGVyYXRvciA9IHRoaXMuX2l0ZW1zLmxlbmd0aDtcclxuXHRcdFx0aWYgKGl0ZXJhdG9yKSB7XHJcblx0XHRcdFx0cmVjaXByb2NhbEl0ZW1zV2lkdGggPSB0aGlzLl9pdGVtc1stLWl0ZXJhdG9yXS53aWR0aCgpO1xyXG5cdFx0XHRcdGVsZW1lbnRXaWR0aCA9IHRoaXMuJGVsZW1lbnQud2lkdGgoKTtcclxuXHRcdFx0XHR3aGlsZSAoaXRlcmF0b3ItLSkge1xyXG5cdFx0XHRcdFx0cmVjaXByb2NhbEl0ZW1zV2lkdGggKz0gdGhpcy5faXRlbXNbaXRlcmF0b3JdLndpZHRoKCkgKyB0aGlzLnNldHRpbmdzLm1hcmdpbjtcclxuXHRcdFx0XHRcdGlmIChyZWNpcHJvY2FsSXRlbXNXaWR0aCA+IGVsZW1lbnRXaWR0aCkge1xyXG5cdFx0XHRcdFx0XHRicmVhaztcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHR9XHJcblx0XHRcdH1cclxuXHRcdFx0bWF4aW11bSA9IGl0ZXJhdG9yICsgMTtcclxuXHRcdH0gZWxzZSBpZiAoc2V0dGluZ3MuY2VudGVyKSB7XHJcblx0XHRcdG1heGltdW0gPSB0aGlzLl9pdGVtcy5sZW5ndGggLSAxO1xyXG5cdFx0fSBlbHNlIHtcclxuXHRcdFx0bWF4aW11bSA9IHRoaXMuX2l0ZW1zLmxlbmd0aCAtIHNldHRpbmdzLml0ZW1zO1xyXG5cdFx0fVxyXG5cclxuXHRcdGlmIChyZWxhdGl2ZSkge1xyXG5cdFx0XHRtYXhpbXVtIC09IHRoaXMuX2Nsb25lcy5sZW5ndGggLyAyO1xyXG5cdFx0fVxyXG5cclxuXHRcdHJldHVybiBNYXRoLm1heChtYXhpbXVtLCAwKTtcclxuXHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiBHZXRzIHRoZSBtaW5pbXVtIHBvc2l0aW9uIGZvciB0aGUgY3VycmVudCBpdGVtLlxyXG5cdCAqIEBwdWJsaWNcclxuXHQgKiBAcGFyYW0ge0Jvb2xlYW59IFtyZWxhdGl2ZT1mYWxzZV0gLSBXaGV0aGVyIHRvIHJldHVybiBhbiBhYnNvbHV0ZSBwb3NpdGlvbiBvciBhIHJlbGF0aXZlIHBvc2l0aW9uLlxyXG5cdCAqIEByZXR1cm5zIHtOdW1iZXJ9XHJcblx0ICovXHJcblx0T3dsLnByb3RvdHlwZS5taW5pbXVtID0gZnVuY3Rpb24ocmVsYXRpdmUpIHtcclxuXHRcdHJldHVybiByZWxhdGl2ZSA/IDAgOiB0aGlzLl9jbG9uZXMubGVuZ3RoIC8gMjtcclxuXHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiBHZXRzIGFuIGl0ZW0gYXQgdGhlIHNwZWNpZmllZCByZWxhdGl2ZSBwb3NpdGlvbi5cclxuXHQgKiBAcHVibGljXHJcblx0ICogQHBhcmFtIHtOdW1iZXJ9IFtwb3NpdGlvbl0gLSBUaGUgcmVsYXRpdmUgcG9zaXRpb24gb2YgdGhlIGl0ZW0uXHJcblx0ICogQHJldHVybiB7alF1ZXJ5fEFycmF5LjxqUXVlcnk+fSAtIFRoZSBpdGVtIGF0IHRoZSBnaXZlbiBwb3NpdGlvbiBvciBhbGwgaXRlbXMgaWYgbm8gcG9zaXRpb24gd2FzIGdpdmVuLlxyXG5cdCAqL1xyXG5cdE93bC5wcm90b3R5cGUuaXRlbXMgPSBmdW5jdGlvbihwb3NpdGlvbikge1xyXG5cdFx0aWYgKHBvc2l0aW9uID09PSB1bmRlZmluZWQpIHtcclxuXHRcdFx0cmV0dXJuIHRoaXMuX2l0ZW1zLnNsaWNlKCk7XHJcblx0XHR9XHJcblxyXG5cdFx0cG9zaXRpb24gPSB0aGlzLm5vcm1hbGl6ZShwb3NpdGlvbiwgdHJ1ZSk7XHJcblx0XHRyZXR1cm4gdGhpcy5faXRlbXNbcG9zaXRpb25dO1xyXG5cdH07XHJcblxyXG5cdC8qKlxyXG5cdCAqIEdldHMgYW4gaXRlbSBhdCB0aGUgc3BlY2lmaWVkIHJlbGF0aXZlIHBvc2l0aW9uLlxyXG5cdCAqIEBwdWJsaWNcclxuXHQgKiBAcGFyYW0ge051bWJlcn0gW3Bvc2l0aW9uXSAtIFRoZSByZWxhdGl2ZSBwb3NpdGlvbiBvZiB0aGUgaXRlbS5cclxuXHQgKiBAcmV0dXJuIHtqUXVlcnl8QXJyYXkuPGpRdWVyeT59IC0gVGhlIGl0ZW0gYXQgdGhlIGdpdmVuIHBvc2l0aW9uIG9yIGFsbCBpdGVtcyBpZiBubyBwb3NpdGlvbiB3YXMgZ2l2ZW4uXHJcblx0ICovXHJcblx0T3dsLnByb3RvdHlwZS5tZXJnZXJzID0gZnVuY3Rpb24ocG9zaXRpb24pIHtcclxuXHRcdGlmIChwb3NpdGlvbiA9PT0gdW5kZWZpbmVkKSB7XHJcblx0XHRcdHJldHVybiB0aGlzLl9tZXJnZXJzLnNsaWNlKCk7XHJcblx0XHR9XHJcblxyXG5cdFx0cG9zaXRpb24gPSB0aGlzLm5vcm1hbGl6ZShwb3NpdGlvbiwgdHJ1ZSk7XHJcblx0XHRyZXR1cm4gdGhpcy5fbWVyZ2Vyc1twb3NpdGlvbl07XHJcblx0fTtcclxuXHJcblx0LyoqXHJcblx0ICogR2V0cyB0aGUgYWJzb2x1dGUgcG9zaXRpb25zIG9mIGNsb25lcyBmb3IgYW4gaXRlbS5cclxuXHQgKiBAcHVibGljXHJcblx0ICogQHBhcmFtIHtOdW1iZXJ9IFtwb3NpdGlvbl0gLSBUaGUgcmVsYXRpdmUgcG9zaXRpb24gb2YgdGhlIGl0ZW0uXHJcblx0ICogQHJldHVybnMge0FycmF5LjxOdW1iZXI+fSAtIFRoZSBhYnNvbHV0ZSBwb3NpdGlvbnMgb2YgY2xvbmVzIGZvciB0aGUgaXRlbSBvciBhbGwgaWYgbm8gcG9zaXRpb24gd2FzIGdpdmVuLlxyXG5cdCAqL1xyXG5cdE93bC5wcm90b3R5cGUuY2xvbmVzID0gZnVuY3Rpb24ocG9zaXRpb24pIHtcclxuXHRcdHZhciBvZGQgPSB0aGlzLl9jbG9uZXMubGVuZ3RoIC8gMixcclxuXHRcdFx0ZXZlbiA9IG9kZCArIHRoaXMuX2l0ZW1zLmxlbmd0aCxcclxuXHRcdFx0bWFwID0gZnVuY3Rpb24oaW5kZXgpIHsgcmV0dXJuIGluZGV4ICUgMiA9PT0gMCA/IGV2ZW4gKyBpbmRleCAvIDIgOiBvZGQgLSAoaW5kZXggKyAxKSAvIDIgfTtcclxuXHJcblx0XHRpZiAocG9zaXRpb24gPT09IHVuZGVmaW5lZCkge1xyXG5cdFx0XHRyZXR1cm4gJC5tYXAodGhpcy5fY2xvbmVzLCBmdW5jdGlvbih2LCBpKSB7IHJldHVybiBtYXAoaSkgfSk7XHJcblx0XHR9XHJcblxyXG5cdFx0cmV0dXJuICQubWFwKHRoaXMuX2Nsb25lcywgZnVuY3Rpb24odiwgaSkgeyByZXR1cm4gdiA9PT0gcG9zaXRpb24gPyBtYXAoaSkgOiBudWxsIH0pO1xyXG5cdH07XHJcblxyXG5cdC8qKlxyXG5cdCAqIFNldHMgdGhlIGN1cnJlbnQgYW5pbWF0aW9uIHNwZWVkLlxyXG5cdCAqIEBwdWJsaWNcclxuXHQgKiBAcGFyYW0ge051bWJlcn0gW3NwZWVkXSAtIFRoZSBhbmltYXRpb24gc3BlZWQgaW4gbWlsbGlzZWNvbmRzIG9yIG5vdGhpbmcgdG8gbGVhdmUgaXQgdW5jaGFuZ2VkLlxyXG5cdCAqIEByZXR1cm5zIHtOdW1iZXJ9IC0gVGhlIGN1cnJlbnQgYW5pbWF0aW9uIHNwZWVkIGluIG1pbGxpc2Vjb25kcy5cclxuXHQgKi9cclxuXHRPd2wucHJvdG90eXBlLnNwZWVkID0gZnVuY3Rpb24oc3BlZWQpIHtcclxuXHRcdGlmIChzcGVlZCAhPT0gdW5kZWZpbmVkKSB7XHJcblx0XHRcdHRoaXMuX3NwZWVkID0gc3BlZWQ7XHJcblx0XHR9XHJcblxyXG5cdFx0cmV0dXJuIHRoaXMuX3NwZWVkO1xyXG5cdH07XHJcblxyXG5cdC8qKlxyXG5cdCAqIEdldHMgdGhlIGNvb3JkaW5hdGUgb2YgYW4gaXRlbS5cclxuXHQgKiBAdG9kbyBUaGUgbmFtZSBvZiB0aGlzIG1ldGhvZCBpcyBtaXNzbGVhbmRpbmcuXHJcblx0ICogQHB1YmxpY1xyXG5cdCAqIEBwYXJhbSB7TnVtYmVyfSBwb3NpdGlvbiAtIFRoZSBhYnNvbHV0ZSBwb3NpdGlvbiBvZiB0aGUgaXRlbSB3aXRoaW4gYG1pbmltdW0oKWAgYW5kIGBtYXhpbXVtKClgLlxyXG5cdCAqIEByZXR1cm5zIHtOdW1iZXJ8QXJyYXkuPE51bWJlcj59IC0gVGhlIGNvb3JkaW5hdGUgb2YgdGhlIGl0ZW0gaW4gcGl4ZWwgb3IgYWxsIGNvb3JkaW5hdGVzLlxyXG5cdCAqL1xyXG5cdE93bC5wcm90b3R5cGUuY29vcmRpbmF0ZXMgPSBmdW5jdGlvbihwb3NpdGlvbikge1xyXG5cdFx0dmFyIG11bHRpcGxpZXIgPSAxLFxyXG5cdFx0XHRuZXdQb3NpdGlvbiA9IHBvc2l0aW9uIC0gMSxcclxuXHRcdFx0Y29vcmRpbmF0ZTtcclxuXHJcblx0XHRpZiAocG9zaXRpb24gPT09IHVuZGVmaW5lZCkge1xyXG5cdFx0XHRyZXR1cm4gJC5tYXAodGhpcy5fY29vcmRpbmF0ZXMsICQucHJveHkoZnVuY3Rpb24oY29vcmRpbmF0ZSwgaW5kZXgpIHtcclxuXHRcdFx0XHRyZXR1cm4gdGhpcy5jb29yZGluYXRlcyhpbmRleCk7XHJcblx0XHRcdH0sIHRoaXMpKTtcclxuXHRcdH1cclxuXHJcblx0XHRpZiAodGhpcy5zZXR0aW5ncy5jZW50ZXIpIHtcclxuXHRcdFx0aWYgKHRoaXMuc2V0dGluZ3MucnRsKSB7XHJcblx0XHRcdFx0bXVsdGlwbGllciA9IC0xO1xyXG5cdFx0XHRcdG5ld1Bvc2l0aW9uID0gcG9zaXRpb24gKyAxO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRjb29yZGluYXRlID0gdGhpcy5fY29vcmRpbmF0ZXNbcG9zaXRpb25dO1xyXG5cdFx0XHRjb29yZGluYXRlICs9ICh0aGlzLndpZHRoKCkgLSBjb29yZGluYXRlICsgKHRoaXMuX2Nvb3JkaW5hdGVzW25ld1Bvc2l0aW9uXSB8fCAwKSkgLyAyICogbXVsdGlwbGllcjtcclxuXHRcdH0gZWxzZSB7XHJcblx0XHRcdGNvb3JkaW5hdGUgPSB0aGlzLl9jb29yZGluYXRlc1tuZXdQb3NpdGlvbl0gfHwgMDtcclxuXHRcdH1cclxuXHJcblx0XHRjb29yZGluYXRlID0gTWF0aC5jZWlsKGNvb3JkaW5hdGUpO1xyXG5cclxuXHRcdHJldHVybiBjb29yZGluYXRlO1xyXG5cdH07XHJcblxyXG5cdC8qKlxyXG5cdCAqIENhbGN1bGF0ZXMgdGhlIHNwZWVkIGZvciBhIHRyYW5zbGF0aW9uLlxyXG5cdCAqIEBwcm90ZWN0ZWRcclxuXHQgKiBAcGFyYW0ge051bWJlcn0gZnJvbSAtIFRoZSBhYnNvbHV0ZSBwb3NpdGlvbiBvZiB0aGUgc3RhcnQgaXRlbS5cclxuXHQgKiBAcGFyYW0ge051bWJlcn0gdG8gLSBUaGUgYWJzb2x1dGUgcG9zaXRpb24gb2YgdGhlIHRhcmdldCBpdGVtLlxyXG5cdCAqIEBwYXJhbSB7TnVtYmVyfSBbZmFjdG9yPXVuZGVmaW5lZF0gLSBUaGUgdGltZSBmYWN0b3IgaW4gbWlsbGlzZWNvbmRzLlxyXG5cdCAqIEByZXR1cm5zIHtOdW1iZXJ9IC0gVGhlIHRpbWUgaW4gbWlsbGlzZWNvbmRzIGZvciB0aGUgdHJhbnNsYXRpb24uXHJcblx0ICovXHJcblx0T3dsLnByb3RvdHlwZS5kdXJhdGlvbiA9IGZ1bmN0aW9uKGZyb20sIHRvLCBmYWN0b3IpIHtcclxuXHRcdGlmIChmYWN0b3IgPT09IDApIHtcclxuXHRcdFx0cmV0dXJuIDA7XHJcblx0XHR9XHJcblxyXG5cdFx0cmV0dXJuIE1hdGgubWluKE1hdGgubWF4KE1hdGguYWJzKHRvIC0gZnJvbSksIDEpLCA2KSAqIE1hdGguYWJzKChmYWN0b3IgfHwgdGhpcy5zZXR0aW5ncy5zbWFydFNwZWVkKSk7XHJcblx0fTtcclxuXHJcblx0LyoqXHJcblx0ICogU2xpZGVzIHRvIHRoZSBzcGVjaWZpZWQgaXRlbS5cclxuXHQgKiBAcHVibGljXHJcblx0ICogQHBhcmFtIHtOdW1iZXJ9IHBvc2l0aW9uIC0gVGhlIHBvc2l0aW9uIG9mIHRoZSBpdGVtLlxyXG5cdCAqIEBwYXJhbSB7TnVtYmVyfSBbc3BlZWRdIC0gVGhlIHRpbWUgaW4gbWlsbGlzZWNvbmRzIGZvciB0aGUgdHJhbnNpdGlvbi5cclxuXHQgKi9cclxuXHRPd2wucHJvdG90eXBlLnRvID0gZnVuY3Rpb24ocG9zaXRpb24sIHNwZWVkKSB7XHJcblx0XHR2YXIgY3VycmVudCA9IHRoaXMuY3VycmVudCgpLFxyXG5cdFx0XHRyZXZlcnQgPSBudWxsLFxyXG5cdFx0XHRkaXN0YW5jZSA9IHBvc2l0aW9uIC0gdGhpcy5yZWxhdGl2ZShjdXJyZW50KSxcclxuXHRcdFx0ZGlyZWN0aW9uID0gKGRpc3RhbmNlID4gMCkgLSAoZGlzdGFuY2UgPCAwKSxcclxuXHRcdFx0aXRlbXMgPSB0aGlzLl9pdGVtcy5sZW5ndGgsXHJcblx0XHRcdG1pbmltdW0gPSB0aGlzLm1pbmltdW0oKSxcclxuXHRcdFx0bWF4aW11bSA9IHRoaXMubWF4aW11bSgpO1xyXG5cclxuXHRcdGlmICh0aGlzLnNldHRpbmdzLmxvb3ApIHtcclxuXHRcdFx0aWYgKCF0aGlzLnNldHRpbmdzLnJld2luZCAmJiBNYXRoLmFicyhkaXN0YW5jZSkgPiBpdGVtcyAvIDIpIHtcclxuXHRcdFx0XHRkaXN0YW5jZSArPSBkaXJlY3Rpb24gKiAtMSAqIGl0ZW1zO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRwb3NpdGlvbiA9IGN1cnJlbnQgKyBkaXN0YW5jZTtcclxuXHRcdFx0cmV2ZXJ0ID0gKChwb3NpdGlvbiAtIG1pbmltdW0pICUgaXRlbXMgKyBpdGVtcykgJSBpdGVtcyArIG1pbmltdW07XHJcblxyXG5cdFx0XHRpZiAocmV2ZXJ0ICE9PSBwb3NpdGlvbiAmJiByZXZlcnQgLSBkaXN0YW5jZSA8PSBtYXhpbXVtICYmIHJldmVydCAtIGRpc3RhbmNlID4gMCkge1xyXG5cdFx0XHRcdGN1cnJlbnQgPSByZXZlcnQgLSBkaXN0YW5jZTtcclxuXHRcdFx0XHRwb3NpdGlvbiA9IHJldmVydDtcclxuXHRcdFx0XHR0aGlzLnJlc2V0KGN1cnJlbnQpO1xyXG5cdFx0XHR9XHJcblx0XHR9IGVsc2UgaWYgKHRoaXMuc2V0dGluZ3MucmV3aW5kKSB7XHJcblx0XHRcdG1heGltdW0gKz0gMTtcclxuXHRcdFx0cG9zaXRpb24gPSAocG9zaXRpb24gJSBtYXhpbXVtICsgbWF4aW11bSkgJSBtYXhpbXVtO1xyXG5cdFx0fSBlbHNlIHtcclxuXHRcdFx0cG9zaXRpb24gPSBNYXRoLm1heChtaW5pbXVtLCBNYXRoLm1pbihtYXhpbXVtLCBwb3NpdGlvbikpO1xyXG5cdFx0fVxyXG5cclxuXHRcdHRoaXMuc3BlZWQodGhpcy5kdXJhdGlvbihjdXJyZW50LCBwb3NpdGlvbiwgc3BlZWQpKTtcclxuXHRcdHRoaXMuY3VycmVudChwb3NpdGlvbik7XHJcblxyXG5cdFx0aWYgKHRoaXMuaXNWaXNpYmxlKCkpIHtcclxuXHRcdFx0dGhpcy51cGRhdGUoKTtcclxuXHRcdH1cclxuXHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiBTbGlkZXMgdG8gdGhlIG5leHQgaXRlbS5cclxuXHQgKiBAcHVibGljXHJcblx0ICogQHBhcmFtIHtOdW1iZXJ9IFtzcGVlZF0gLSBUaGUgdGltZSBpbiBtaWxsaXNlY29uZHMgZm9yIHRoZSB0cmFuc2l0aW9uLlxyXG5cdCAqL1xyXG5cdE93bC5wcm90b3R5cGUubmV4dCA9IGZ1bmN0aW9uKHNwZWVkKSB7XHJcblx0XHRzcGVlZCA9IHNwZWVkIHx8IGZhbHNlO1xyXG5cdFx0dGhpcy50byh0aGlzLnJlbGF0aXZlKHRoaXMuY3VycmVudCgpKSArIDEsIHNwZWVkKTtcclxuXHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiBTbGlkZXMgdG8gdGhlIHByZXZpb3VzIGl0ZW0uXHJcblx0ICogQHB1YmxpY1xyXG5cdCAqIEBwYXJhbSB7TnVtYmVyfSBbc3BlZWRdIC0gVGhlIHRpbWUgaW4gbWlsbGlzZWNvbmRzIGZvciB0aGUgdHJhbnNpdGlvbi5cclxuXHQgKi9cclxuXHRPd2wucHJvdG90eXBlLnByZXYgPSBmdW5jdGlvbihzcGVlZCkge1xyXG5cdFx0c3BlZWQgPSBzcGVlZCB8fCBmYWxzZTtcclxuXHRcdHRoaXMudG8odGhpcy5yZWxhdGl2ZSh0aGlzLmN1cnJlbnQoKSkgLSAxLCBzcGVlZCk7XHJcblx0fTtcclxuXHJcblx0LyoqXHJcblx0ICogSGFuZGxlcyB0aGUgZW5kIG9mIGFuIGFuaW1hdGlvbi5cclxuXHQgKiBAcHJvdGVjdGVkXHJcblx0ICogQHBhcmFtIHtFdmVudH0gZXZlbnQgLSBUaGUgZXZlbnQgYXJndW1lbnRzLlxyXG5cdCAqL1xyXG5cdE93bC5wcm90b3R5cGUub25UcmFuc2l0aW9uRW5kID0gZnVuY3Rpb24oZXZlbnQpIHtcclxuXHJcblx0XHQvLyBpZiBjc3MyIGFuaW1hdGlvbiB0aGVuIGV2ZW50IG9iamVjdCBpcyB1bmRlZmluZWRcclxuXHRcdGlmIChldmVudCAhPT0gdW5kZWZpbmVkKSB7XHJcblx0XHRcdGV2ZW50LnN0b3BQcm9wYWdhdGlvbigpO1xyXG5cclxuXHRcdFx0Ly8gQ2F0Y2ggb25seSBvd2wtc3RhZ2UgdHJhbnNpdGlvbkVuZCBldmVudFxyXG5cdFx0XHRpZiAoKGV2ZW50LnRhcmdldCB8fCBldmVudC5zcmNFbGVtZW50IHx8IGV2ZW50Lm9yaWdpbmFsVGFyZ2V0KSAhPT0gdGhpcy4kc3RhZ2UuZ2V0KDApKSB7XHJcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblxyXG5cdFx0dGhpcy5sZWF2ZSgnYW5pbWF0aW5nJyk7XHJcblx0XHR0aGlzLnRyaWdnZXIoJ3RyYW5zbGF0ZWQnKTtcclxuXHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiBHZXRzIHZpZXdwb3J0IHdpZHRoLlxyXG5cdCAqIEBwcm90ZWN0ZWRcclxuXHQgKiBAcmV0dXJuIHtOdW1iZXJ9IC0gVGhlIHdpZHRoIGluIHBpeGVsLlxyXG5cdCAqL1xyXG5cdE93bC5wcm90b3R5cGUudmlld3BvcnQgPSBmdW5jdGlvbigpIHtcclxuXHRcdHZhciB3aWR0aDtcclxuXHRcdGlmICh0aGlzLm9wdGlvbnMucmVzcG9uc2l2ZUJhc2VFbGVtZW50ICE9PSB3aW5kb3cpIHtcclxuXHRcdFx0d2lkdGggPSAkKHRoaXMub3B0aW9ucy5yZXNwb25zaXZlQmFzZUVsZW1lbnQpLndpZHRoKCk7XHJcblx0XHR9IGVsc2UgaWYgKHdpbmRvdy5pbm5lcldpZHRoKSB7XHJcblx0XHRcdHdpZHRoID0gd2luZG93LmlubmVyV2lkdGg7XHJcblx0XHR9IGVsc2UgaWYgKGRvY3VtZW50LmRvY3VtZW50RWxlbWVudCAmJiBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQuY2xpZW50V2lkdGgpIHtcclxuXHRcdFx0d2lkdGggPSBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQuY2xpZW50V2lkdGg7XHJcblx0XHR9IGVsc2Uge1xyXG5cdFx0XHRjb25zb2xlLndhcm4oJ0NhbiBub3QgZGV0ZWN0IHZpZXdwb3J0IHdpZHRoLicpO1xyXG5cdFx0fVxyXG5cdFx0cmV0dXJuIHdpZHRoO1xyXG5cdH07XHJcblxyXG5cdC8qKlxyXG5cdCAqIFJlcGxhY2VzIHRoZSBjdXJyZW50IGNvbnRlbnQuXHJcblx0ICogQHB1YmxpY1xyXG5cdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR8alF1ZXJ5fFN0cmluZ30gY29udGVudCAtIFRoZSBuZXcgY29udGVudC5cclxuXHQgKi9cclxuXHRPd2wucHJvdG90eXBlLnJlcGxhY2UgPSBmdW5jdGlvbihjb250ZW50KSB7XHJcblx0XHR0aGlzLiRzdGFnZS5lbXB0eSgpO1xyXG5cdFx0dGhpcy5faXRlbXMgPSBbXTtcclxuXHJcblx0XHRpZiAoY29udGVudCkge1xyXG5cdFx0XHRjb250ZW50ID0gKGNvbnRlbnQgaW5zdGFuY2VvZiBqUXVlcnkpID8gY29udGVudCA6ICQoY29udGVudCk7XHJcblx0XHR9XHJcblxyXG5cdFx0aWYgKHRoaXMuc2V0dGluZ3MubmVzdGVkSXRlbVNlbGVjdG9yKSB7XHJcblx0XHRcdGNvbnRlbnQgPSBjb250ZW50LmZpbmQoJy4nICsgdGhpcy5zZXR0aW5ncy5uZXN0ZWRJdGVtU2VsZWN0b3IpO1xyXG5cdFx0fVxyXG5cclxuXHRcdGNvbnRlbnQuZmlsdGVyKGZ1bmN0aW9uKCkge1xyXG5cdFx0XHRyZXR1cm4gdGhpcy5ub2RlVHlwZSA9PT0gMTtcclxuXHRcdH0pLmVhY2goJC5wcm94eShmdW5jdGlvbihpbmRleCwgaXRlbSkge1xyXG5cdFx0XHRpdGVtID0gdGhpcy5wcmVwYXJlKGl0ZW0pO1xyXG5cdFx0XHR0aGlzLiRzdGFnZS5hcHBlbmQoaXRlbSk7XHJcblx0XHRcdHRoaXMuX2l0ZW1zLnB1c2goaXRlbSk7XHJcblx0XHRcdHRoaXMuX21lcmdlcnMucHVzaChpdGVtLmZpbmQoJ1tkYXRhLW1lcmdlXScpLmFkZEJhY2soJ1tkYXRhLW1lcmdlXScpLmF0dHIoJ2RhdGEtbWVyZ2UnKSAqIDEgfHwgMSk7XHJcblx0XHR9LCB0aGlzKSk7XHJcblxyXG5cdFx0dGhpcy5yZXNldCh0aGlzLmlzTnVtZXJpYyh0aGlzLnNldHRpbmdzLnN0YXJ0UG9zaXRpb24pID8gdGhpcy5zZXR0aW5ncy5zdGFydFBvc2l0aW9uIDogMCk7XHJcblxyXG5cdFx0dGhpcy5pbnZhbGlkYXRlKCdpdGVtcycpO1xyXG5cdH07XHJcblxyXG5cdC8qKlxyXG5cdCAqIEFkZHMgYW4gaXRlbS5cclxuXHQgKiBAdG9kbyBVc2UgYGl0ZW1gIGluc3RlYWQgb2YgYGNvbnRlbnRgIGZvciB0aGUgZXZlbnQgYXJndW1lbnRzLlxyXG5cdCAqIEBwdWJsaWNcclxuXHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fGpRdWVyeXxTdHJpbmd9IGNvbnRlbnQgLSBUaGUgaXRlbSBjb250ZW50IHRvIGFkZC5cclxuXHQgKiBAcGFyYW0ge051bWJlcn0gW3Bvc2l0aW9uXSAtIFRoZSByZWxhdGl2ZSBwb3NpdGlvbiBhdCB3aGljaCB0byBpbnNlcnQgdGhlIGl0ZW0gb3RoZXJ3aXNlIHRoZSBpdGVtIHdpbGwgYmUgYWRkZWQgdG8gdGhlIGVuZC5cclxuXHQgKi9cclxuXHRPd2wucHJvdG90eXBlLmFkZCA9IGZ1bmN0aW9uKGNvbnRlbnQsIHBvc2l0aW9uKSB7XHJcblx0XHR2YXIgY3VycmVudCA9IHRoaXMucmVsYXRpdmUodGhpcy5fY3VycmVudCk7XHJcblxyXG5cdFx0cG9zaXRpb24gPSBwb3NpdGlvbiA9PT0gdW5kZWZpbmVkID8gdGhpcy5faXRlbXMubGVuZ3RoIDogdGhpcy5ub3JtYWxpemUocG9zaXRpb24sIHRydWUpO1xyXG5cdFx0Y29udGVudCA9IGNvbnRlbnQgaW5zdGFuY2VvZiBqUXVlcnkgPyBjb250ZW50IDogJChjb250ZW50KTtcclxuXHJcblx0XHR0aGlzLnRyaWdnZXIoJ2FkZCcsIHsgY29udGVudDogY29udGVudCwgcG9zaXRpb246IHBvc2l0aW9uIH0pO1xyXG5cclxuXHRcdGNvbnRlbnQgPSB0aGlzLnByZXBhcmUoY29udGVudCk7XHJcblxyXG5cdFx0aWYgKHRoaXMuX2l0ZW1zLmxlbmd0aCA9PT0gMCB8fCBwb3NpdGlvbiA9PT0gdGhpcy5faXRlbXMubGVuZ3RoKSB7XHJcblx0XHRcdHRoaXMuX2l0ZW1zLmxlbmd0aCA9PT0gMCAmJiB0aGlzLiRzdGFnZS5hcHBlbmQoY29udGVudCk7XHJcblx0XHRcdHRoaXMuX2l0ZW1zLmxlbmd0aCAhPT0gMCAmJiB0aGlzLl9pdGVtc1twb3NpdGlvbiAtIDFdLmFmdGVyKGNvbnRlbnQpO1xyXG5cdFx0XHR0aGlzLl9pdGVtcy5wdXNoKGNvbnRlbnQpO1xyXG5cdFx0XHR0aGlzLl9tZXJnZXJzLnB1c2goY29udGVudC5maW5kKCdbZGF0YS1tZXJnZV0nKS5hZGRCYWNrKCdbZGF0YS1tZXJnZV0nKS5hdHRyKCdkYXRhLW1lcmdlJykgKiAxIHx8IDEpO1xyXG5cdFx0fSBlbHNlIHtcclxuXHRcdFx0dGhpcy5faXRlbXNbcG9zaXRpb25dLmJlZm9yZShjb250ZW50KTtcclxuXHRcdFx0dGhpcy5faXRlbXMuc3BsaWNlKHBvc2l0aW9uLCAwLCBjb250ZW50KTtcclxuXHRcdFx0dGhpcy5fbWVyZ2Vycy5zcGxpY2UocG9zaXRpb24sIDAsIGNvbnRlbnQuZmluZCgnW2RhdGEtbWVyZ2VdJykuYWRkQmFjaygnW2RhdGEtbWVyZ2VdJykuYXR0cignZGF0YS1tZXJnZScpICogMSB8fCAxKTtcclxuXHRcdH1cclxuXHJcblx0XHR0aGlzLl9pdGVtc1tjdXJyZW50XSAmJiB0aGlzLnJlc2V0KHRoaXMuX2l0ZW1zW2N1cnJlbnRdLmluZGV4KCkpO1xyXG5cclxuXHRcdHRoaXMuaW52YWxpZGF0ZSgnaXRlbXMnKTtcclxuXHJcblx0XHR0aGlzLnRyaWdnZXIoJ2FkZGVkJywgeyBjb250ZW50OiBjb250ZW50LCBwb3NpdGlvbjogcG9zaXRpb24gfSk7XHJcblx0fTtcclxuXHJcblx0LyoqXHJcblx0ICogUmVtb3ZlcyBhbiBpdGVtIGJ5IGl0cyBwb3NpdGlvbi5cclxuXHQgKiBAdG9kbyBVc2UgYGl0ZW1gIGluc3RlYWQgb2YgYGNvbnRlbnRgIGZvciB0aGUgZXZlbnQgYXJndW1lbnRzLlxyXG5cdCAqIEBwdWJsaWNcclxuXHQgKiBAcGFyYW0ge051bWJlcn0gcG9zaXRpb24gLSBUaGUgcmVsYXRpdmUgcG9zaXRpb24gb2YgdGhlIGl0ZW0gdG8gcmVtb3ZlLlxyXG5cdCAqL1xyXG5cdE93bC5wcm90b3R5cGUucmVtb3ZlID0gZnVuY3Rpb24ocG9zaXRpb24pIHtcclxuXHRcdHBvc2l0aW9uID0gdGhpcy5ub3JtYWxpemUocG9zaXRpb24sIHRydWUpO1xyXG5cclxuXHRcdGlmIChwb3NpdGlvbiA9PT0gdW5kZWZpbmVkKSB7XHJcblx0XHRcdHJldHVybjtcclxuXHRcdH1cclxuXHJcblx0XHR0aGlzLnRyaWdnZXIoJ3JlbW92ZScsIHsgY29udGVudDogdGhpcy5faXRlbXNbcG9zaXRpb25dLCBwb3NpdGlvbjogcG9zaXRpb24gfSk7XHJcblxyXG5cdFx0dGhpcy5faXRlbXNbcG9zaXRpb25dLnJlbW92ZSgpO1xyXG5cdFx0dGhpcy5faXRlbXMuc3BsaWNlKHBvc2l0aW9uLCAxKTtcclxuXHRcdHRoaXMuX21lcmdlcnMuc3BsaWNlKHBvc2l0aW9uLCAxKTtcclxuXHJcblx0XHR0aGlzLmludmFsaWRhdGUoJ2l0ZW1zJyk7XHJcblxyXG5cdFx0dGhpcy50cmlnZ2VyKCdyZW1vdmVkJywgeyBjb250ZW50OiBudWxsLCBwb3NpdGlvbjogcG9zaXRpb24gfSk7XHJcblx0fTtcclxuXHJcblx0LyoqXHJcblx0ICogUHJlbG9hZHMgaW1hZ2VzIHdpdGggYXV0byB3aWR0aC5cclxuXHQgKiBAdG9kbyBSZXBsYWNlIGJ5IGEgbW9yZSBnZW5lcmljIGFwcHJvYWNoXHJcblx0ICogQHByb3RlY3RlZFxyXG5cdCAqL1xyXG5cdE93bC5wcm90b3R5cGUucHJlbG9hZEF1dG9XaWR0aEltYWdlcyA9IGZ1bmN0aW9uKGltYWdlcykge1xyXG5cdFx0aW1hZ2VzLmVhY2goJC5wcm94eShmdW5jdGlvbihpLCBlbGVtZW50KSB7XHJcblx0XHRcdHRoaXMuZW50ZXIoJ3ByZS1sb2FkaW5nJyk7XHJcblx0XHRcdGVsZW1lbnQgPSAkKGVsZW1lbnQpO1xyXG5cdFx0XHQkKG5ldyBJbWFnZSgpKS5vbmUoJ2xvYWQnLCAkLnByb3h5KGZ1bmN0aW9uKGUpIHtcclxuXHRcdFx0XHRlbGVtZW50LmF0dHIoJ3NyYycsIGUudGFyZ2V0LnNyYyk7XHJcblx0XHRcdFx0ZWxlbWVudC5jc3MoJ29wYWNpdHknLCAxKTtcclxuXHRcdFx0XHR0aGlzLmxlYXZlKCdwcmUtbG9hZGluZycpO1xyXG5cdFx0XHRcdCF0aGlzLmlzKCdwcmUtbG9hZGluZycpICYmICF0aGlzLmlzKCdpbml0aWFsaXppbmcnKSAmJiB0aGlzLnJlZnJlc2goKTtcclxuXHRcdFx0fSwgdGhpcykpLmF0dHIoJ3NyYycsIGVsZW1lbnQuYXR0cignc3JjJykgfHwgZWxlbWVudC5hdHRyKCdkYXRhLXNyYycpIHx8IGVsZW1lbnQuYXR0cignZGF0YS1zcmMtcmV0aW5hJykpO1xyXG5cdFx0fSwgdGhpcykpO1xyXG5cdH07XHJcblxyXG5cdC8qKlxyXG5cdCAqIERlc3Ryb3lzIHRoZSBjYXJvdXNlbC5cclxuXHQgKiBAcHVibGljXHJcblx0ICovXHJcblx0T3dsLnByb3RvdHlwZS5kZXN0cm95ID0gZnVuY3Rpb24oKSB7XHJcblxyXG5cdFx0dGhpcy4kZWxlbWVudC5vZmYoJy5vd2wuY29yZScpO1xyXG5cdFx0dGhpcy4kc3RhZ2Uub2ZmKCcub3dsLmNvcmUnKTtcclxuXHRcdCQoZG9jdW1lbnQpLm9mZignLm93bC5jb3JlJyk7XHJcblxyXG5cdFx0aWYgKHRoaXMuc2V0dGluZ3MucmVzcG9uc2l2ZSAhPT0gZmFsc2UpIHtcclxuXHRcdFx0d2luZG93LmNsZWFyVGltZW91dCh0aGlzLnJlc2l6ZVRpbWVyKTtcclxuXHRcdFx0dGhpcy5vZmYod2luZG93LCAncmVzaXplJywgdGhpcy5faGFuZGxlcnMub25UaHJvdHRsZWRSZXNpemUpO1xyXG5cdFx0fVxyXG5cclxuXHRcdGZvciAodmFyIGkgaW4gdGhpcy5fcGx1Z2lucykge1xyXG5cdFx0XHR0aGlzLl9wbHVnaW5zW2ldLmRlc3Ryb3koKTtcclxuXHRcdH1cclxuXHJcblx0XHR0aGlzLiRzdGFnZS5jaGlsZHJlbignLmNsb25lZCcpLnJlbW92ZSgpO1xyXG5cclxuXHRcdHRoaXMuJHN0YWdlLnVud3JhcCgpO1xyXG5cdFx0dGhpcy4kc3RhZ2UuY2hpbGRyZW4oKS5jb250ZW50cygpLnVud3JhcCgpO1xyXG5cdFx0dGhpcy4kc3RhZ2UuY2hpbGRyZW4oKS51bndyYXAoKTtcclxuXHRcdHRoaXMuJHN0YWdlLnJlbW92ZSgpO1xyXG5cdFx0dGhpcy4kZWxlbWVudFxyXG5cdFx0XHQucmVtb3ZlQ2xhc3ModGhpcy5vcHRpb25zLnJlZnJlc2hDbGFzcylcclxuXHRcdFx0LnJlbW92ZUNsYXNzKHRoaXMub3B0aW9ucy5sb2FkaW5nQ2xhc3MpXHJcblx0XHRcdC5yZW1vdmVDbGFzcyh0aGlzLm9wdGlvbnMubG9hZGVkQ2xhc3MpXHJcblx0XHRcdC5yZW1vdmVDbGFzcyh0aGlzLm9wdGlvbnMucnRsQ2xhc3MpXHJcblx0XHRcdC5yZW1vdmVDbGFzcyh0aGlzLm9wdGlvbnMuZHJhZ0NsYXNzKVxyXG5cdFx0XHQucmVtb3ZlQ2xhc3ModGhpcy5vcHRpb25zLmdyYWJDbGFzcylcclxuXHRcdFx0LmF0dHIoJ2NsYXNzJywgdGhpcy4kZWxlbWVudC5hdHRyKCdjbGFzcycpLnJlcGxhY2UobmV3IFJlZ0V4cCh0aGlzLm9wdGlvbnMucmVzcG9uc2l2ZUNsYXNzICsgJy1cXFxcUytcXFxccycsICdnJyksICcnKSlcclxuXHRcdFx0LnJlbW92ZURhdGEoJ293bC5jYXJvdXNlbCcpO1xyXG5cdH07XHJcblxyXG5cdC8qKlxyXG5cdCAqIE9wZXJhdG9ycyB0byBjYWxjdWxhdGUgcmlnaHQtdG8tbGVmdCBhbmQgbGVmdC10by1yaWdodC5cclxuXHQgKiBAcHJvdGVjdGVkXHJcblx0ICogQHBhcmFtIHtOdW1iZXJ9IFthXSAtIFRoZSBsZWZ0IHNpZGUgb3BlcmFuZC5cclxuXHQgKiBAcGFyYW0ge1N0cmluZ30gW29dIC0gVGhlIG9wZXJhdG9yLlxyXG5cdCAqIEBwYXJhbSB7TnVtYmVyfSBbYl0gLSBUaGUgcmlnaHQgc2lkZSBvcGVyYW5kLlxyXG5cdCAqL1xyXG5cdE93bC5wcm90b3R5cGUub3AgPSBmdW5jdGlvbihhLCBvLCBiKSB7XHJcblx0XHR2YXIgcnRsID0gdGhpcy5zZXR0aW5ncy5ydGw7XHJcblx0XHRzd2l0Y2ggKG8pIHtcclxuXHRcdFx0Y2FzZSAnPCc6XHJcblx0XHRcdFx0cmV0dXJuIHJ0bCA/IGEgPiBiIDogYSA8IGI7XHJcblx0XHRcdGNhc2UgJz4nOlxyXG5cdFx0XHRcdHJldHVybiBydGwgPyBhIDwgYiA6IGEgPiBiO1xyXG5cdFx0XHRjYXNlICc+PSc6XHJcblx0XHRcdFx0cmV0dXJuIHJ0bCA/IGEgPD0gYiA6IGEgPj0gYjtcclxuXHRcdFx0Y2FzZSAnPD0nOlxyXG5cdFx0XHRcdHJldHVybiBydGwgPyBhID49IGIgOiBhIDw9IGI7XHJcblx0XHRcdGRlZmF1bHQ6XHJcblx0XHRcdFx0YnJlYWs7XHJcblx0XHR9XHJcblx0fTtcclxuXHJcblx0LyoqXHJcblx0ICogQXR0YWNoZXMgdG8gYW4gaW50ZXJuYWwgZXZlbnQuXHJcblx0ICogQHByb3RlY3RlZFxyXG5cdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IGVsZW1lbnQgLSBUaGUgZXZlbnQgc291cmNlLlxyXG5cdCAqIEBwYXJhbSB7U3RyaW5nfSBldmVudCAtIFRoZSBldmVudCBuYW1lLlxyXG5cdCAqIEBwYXJhbSB7RnVuY3Rpb259IGxpc3RlbmVyIC0gVGhlIGV2ZW50IGhhbmRsZXIgdG8gYXR0YWNoLlxyXG5cdCAqIEBwYXJhbSB7Qm9vbGVhbn0gY2FwdHVyZSAtIFdldGhlciB0aGUgZXZlbnQgc2hvdWxkIGJlIGhhbmRsZWQgYXQgdGhlIGNhcHR1cmluZyBwaGFzZSBvciBub3QuXHJcblx0ICovXHJcblx0T3dsLnByb3RvdHlwZS5vbiA9IGZ1bmN0aW9uKGVsZW1lbnQsIGV2ZW50LCBsaXN0ZW5lciwgY2FwdHVyZSkge1xyXG5cdFx0aWYgKGVsZW1lbnQuYWRkRXZlbnRMaXN0ZW5lcikge1xyXG5cdFx0XHRlbGVtZW50LmFkZEV2ZW50TGlzdGVuZXIoZXZlbnQsIGxpc3RlbmVyLCBjYXB0dXJlKTtcclxuXHRcdH0gZWxzZSBpZiAoZWxlbWVudC5hdHRhY2hFdmVudCkge1xyXG5cdFx0XHRlbGVtZW50LmF0dGFjaEV2ZW50KCdvbicgKyBldmVudCwgbGlzdGVuZXIpO1xyXG5cdFx0fVxyXG5cdH07XHJcblxyXG5cdC8qKlxyXG5cdCAqIERldGFjaGVzIGZyb20gYW4gaW50ZXJuYWwgZXZlbnQuXHJcblx0ICogQHByb3RlY3RlZFxyXG5cdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IGVsZW1lbnQgLSBUaGUgZXZlbnQgc291cmNlLlxyXG5cdCAqIEBwYXJhbSB7U3RyaW5nfSBldmVudCAtIFRoZSBldmVudCBuYW1lLlxyXG5cdCAqIEBwYXJhbSB7RnVuY3Rpb259IGxpc3RlbmVyIC0gVGhlIGF0dGFjaGVkIGV2ZW50IGhhbmRsZXIgdG8gZGV0YWNoLlxyXG5cdCAqIEBwYXJhbSB7Qm9vbGVhbn0gY2FwdHVyZSAtIFdldGhlciB0aGUgYXR0YWNoZWQgZXZlbnQgaGFuZGxlciB3YXMgcmVnaXN0ZXJlZCBhcyBhIGNhcHR1cmluZyBsaXN0ZW5lciBvciBub3QuXHJcblx0ICovXHJcblx0T3dsLnByb3RvdHlwZS5vZmYgPSBmdW5jdGlvbihlbGVtZW50LCBldmVudCwgbGlzdGVuZXIsIGNhcHR1cmUpIHtcclxuXHRcdGlmIChlbGVtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIpIHtcclxuXHRcdFx0ZWxlbWVudC5yZW1vdmVFdmVudExpc3RlbmVyKGV2ZW50LCBsaXN0ZW5lciwgY2FwdHVyZSk7XHJcblx0XHR9IGVsc2UgaWYgKGVsZW1lbnQuZGV0YWNoRXZlbnQpIHtcclxuXHRcdFx0ZWxlbWVudC5kZXRhY2hFdmVudCgnb24nICsgZXZlbnQsIGxpc3RlbmVyKTtcclxuXHRcdH1cclxuXHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiBUcmlnZ2VycyBhIHB1YmxpYyBldmVudC5cclxuXHQgKiBAdG9kbyBSZW1vdmUgYHN0YXR1c2AsIGByZWxhdGVkVGFyZ2V0YCBzaG91bGQgYmUgdXNlZCBpbnN0ZWFkLlxyXG5cdCAqIEBwcm90ZWN0ZWRcclxuXHQgKiBAcGFyYW0ge1N0cmluZ30gbmFtZSAtIFRoZSBldmVudCBuYW1lLlxyXG5cdCAqIEBwYXJhbSB7Kn0gW2RhdGE9bnVsbF0gLSBUaGUgZXZlbnQgZGF0YS5cclxuXHQgKiBAcGFyYW0ge1N0cmluZ30gW25hbWVzcGFjZT1jYXJvdXNlbF0gLSBUaGUgZXZlbnQgbmFtZXNwYWNlLlxyXG5cdCAqIEBwYXJhbSB7U3RyaW5nfSBbc3RhdGVdIC0gVGhlIHN0YXRlIHdoaWNoIGlzIGFzc29jaWF0ZWQgd2l0aCB0aGUgZXZlbnQuXHJcblx0ICogQHBhcmFtIHtCb29sZWFufSBbZW50ZXI9ZmFsc2VdIC0gSW5kaWNhdGVzIGlmIHRoZSBjYWxsIGVudGVycyB0aGUgc3BlY2lmaWVkIHN0YXRlIG9yIG5vdC5cclxuXHQgKiBAcmV0dXJucyB7RXZlbnR9IC0gVGhlIGV2ZW50IGFyZ3VtZW50cy5cclxuXHQgKi9cclxuXHRPd2wucHJvdG90eXBlLnRyaWdnZXIgPSBmdW5jdGlvbihuYW1lLCBkYXRhLCBuYW1lc3BhY2UsIHN0YXRlLCBlbnRlcikge1xyXG5cdFx0dmFyIHN0YXR1cyA9IHtcclxuXHRcdFx0aXRlbTogeyBjb3VudDogdGhpcy5faXRlbXMubGVuZ3RoLCBpbmRleDogdGhpcy5jdXJyZW50KCkgfVxyXG5cdFx0fSwgaGFuZGxlciA9ICQuY2FtZWxDYXNlKFxyXG5cdFx0XHQkLmdyZXAoWyAnb24nLCBuYW1lLCBuYW1lc3BhY2UgXSwgZnVuY3Rpb24odikgeyByZXR1cm4gdiB9KVxyXG5cdFx0XHRcdC5qb2luKCctJykudG9Mb3dlckNhc2UoKVxyXG5cdFx0KSwgZXZlbnQgPSAkLkV2ZW50KFxyXG5cdFx0XHRbIG5hbWUsICdvd2wnLCBuYW1lc3BhY2UgfHwgJ2Nhcm91c2VsJyBdLmpvaW4oJy4nKS50b0xvd2VyQ2FzZSgpLFxyXG5cdFx0XHQkLmV4dGVuZCh7IHJlbGF0ZWRUYXJnZXQ6IHRoaXMgfSwgc3RhdHVzLCBkYXRhKVxyXG5cdFx0KTtcclxuXHJcblx0XHRpZiAoIXRoaXMuX3N1cHJlc3NbbmFtZV0pIHtcclxuXHRcdFx0JC5lYWNoKHRoaXMuX3BsdWdpbnMsIGZ1bmN0aW9uKG5hbWUsIHBsdWdpbikge1xyXG5cdFx0XHRcdGlmIChwbHVnaW4ub25UcmlnZ2VyKSB7XHJcblx0XHRcdFx0XHRwbHVnaW4ub25UcmlnZ2VyKGV2ZW50KTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH0pO1xyXG5cclxuXHRcdFx0dGhpcy5yZWdpc3Rlcih7IHR5cGU6IE93bC5UeXBlLkV2ZW50LCBuYW1lOiBuYW1lIH0pO1xyXG5cdFx0XHR0aGlzLiRlbGVtZW50LnRyaWdnZXIoZXZlbnQpO1xyXG5cclxuXHRcdFx0aWYgKHRoaXMuc2V0dGluZ3MgJiYgdHlwZW9mIHRoaXMuc2V0dGluZ3NbaGFuZGxlcl0gPT09ICdmdW5jdGlvbicpIHtcclxuXHRcdFx0XHR0aGlzLnNldHRpbmdzW2hhbmRsZXJdLmNhbGwodGhpcywgZXZlbnQpO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblxyXG5cdFx0cmV0dXJuIGV2ZW50O1xyXG5cdH07XHJcblxyXG5cdC8qKlxyXG5cdCAqIEVudGVycyBhIHN0YXRlLlxyXG5cdCAqIEBwYXJhbSBuYW1lIC0gVGhlIHN0YXRlIG5hbWUuXHJcblx0ICovXHJcblx0T3dsLnByb3RvdHlwZS5lbnRlciA9IGZ1bmN0aW9uKG5hbWUpIHtcclxuXHRcdCQuZWFjaChbIG5hbWUgXS5jb25jYXQodGhpcy5fc3RhdGVzLnRhZ3NbbmFtZV0gfHwgW10pLCAkLnByb3h5KGZ1bmN0aW9uKGksIG5hbWUpIHtcclxuXHRcdFx0aWYgKHRoaXMuX3N0YXRlcy5jdXJyZW50W25hbWVdID09PSB1bmRlZmluZWQpIHtcclxuXHRcdFx0XHR0aGlzLl9zdGF0ZXMuY3VycmVudFtuYW1lXSA9IDA7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdHRoaXMuX3N0YXRlcy5jdXJyZW50W25hbWVdKys7XHJcblx0XHR9LCB0aGlzKSk7XHJcblx0fTtcclxuXHJcblx0LyoqXHJcblx0ICogTGVhdmVzIGEgc3RhdGUuXHJcblx0ICogQHBhcmFtIG5hbWUgLSBUaGUgc3RhdGUgbmFtZS5cclxuXHQgKi9cclxuXHRPd2wucHJvdG90eXBlLmxlYXZlID0gZnVuY3Rpb24obmFtZSkge1xyXG5cdFx0JC5lYWNoKFsgbmFtZSBdLmNvbmNhdCh0aGlzLl9zdGF0ZXMudGFnc1tuYW1lXSB8fCBbXSksICQucHJveHkoZnVuY3Rpb24oaSwgbmFtZSkge1xyXG5cdFx0XHR0aGlzLl9zdGF0ZXMuY3VycmVudFtuYW1lXS0tO1xyXG5cdFx0fSwgdGhpcykpO1xyXG5cdH07XHJcblxyXG5cdC8qKlxyXG5cdCAqIFJlZ2lzdGVycyBhbiBldmVudCBvciBzdGF0ZS5cclxuXHQgKiBAcHVibGljXHJcblx0ICogQHBhcmFtIHtPYmplY3R9IG9iamVjdCAtIFRoZSBldmVudCBvciBzdGF0ZSB0byByZWdpc3Rlci5cclxuXHQgKi9cclxuXHRPd2wucHJvdG90eXBlLnJlZ2lzdGVyID0gZnVuY3Rpb24ob2JqZWN0KSB7XHJcblx0XHRpZiAob2JqZWN0LnR5cGUgPT09IE93bC5UeXBlLkV2ZW50KSB7XHJcblx0XHRcdGlmICghJC5ldmVudC5zcGVjaWFsW29iamVjdC5uYW1lXSkge1xyXG5cdFx0XHRcdCQuZXZlbnQuc3BlY2lhbFtvYmplY3QubmFtZV0gPSB7fTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0aWYgKCEkLmV2ZW50LnNwZWNpYWxbb2JqZWN0Lm5hbWVdLm93bCkge1xyXG5cdFx0XHRcdHZhciBfZGVmYXVsdCA9ICQuZXZlbnQuc3BlY2lhbFtvYmplY3QubmFtZV0uX2RlZmF1bHQ7XHJcblx0XHRcdFx0JC5ldmVudC5zcGVjaWFsW29iamVjdC5uYW1lXS5fZGVmYXVsdCA9IGZ1bmN0aW9uKGUpIHtcclxuXHRcdFx0XHRcdGlmIChfZGVmYXVsdCAmJiBfZGVmYXVsdC5hcHBseSAmJiAoIWUubmFtZXNwYWNlIHx8IGUubmFtZXNwYWNlLmluZGV4T2YoJ293bCcpID09PSAtMSkpIHtcclxuXHRcdFx0XHRcdFx0cmV0dXJuIF9kZWZhdWx0LmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRyZXR1cm4gZS5uYW1lc3BhY2UgJiYgZS5uYW1lc3BhY2UuaW5kZXhPZignb3dsJykgPiAtMTtcclxuXHRcdFx0XHR9O1xyXG5cdFx0XHRcdCQuZXZlbnQuc3BlY2lhbFtvYmplY3QubmFtZV0ub3dsID0gdHJ1ZTtcclxuXHRcdFx0fVxyXG5cdFx0fSBlbHNlIGlmIChvYmplY3QudHlwZSA9PT0gT3dsLlR5cGUuU3RhdGUpIHtcclxuXHRcdFx0aWYgKCF0aGlzLl9zdGF0ZXMudGFnc1tvYmplY3QubmFtZV0pIHtcclxuXHRcdFx0XHR0aGlzLl9zdGF0ZXMudGFnc1tvYmplY3QubmFtZV0gPSBvYmplY3QudGFncztcclxuXHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHR0aGlzLl9zdGF0ZXMudGFnc1tvYmplY3QubmFtZV0gPSB0aGlzLl9zdGF0ZXMudGFnc1tvYmplY3QubmFtZV0uY29uY2F0KG9iamVjdC50YWdzKTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0dGhpcy5fc3RhdGVzLnRhZ3Nbb2JqZWN0Lm5hbWVdID0gJC5ncmVwKHRoaXMuX3N0YXRlcy50YWdzW29iamVjdC5uYW1lXSwgJC5wcm94eShmdW5jdGlvbih0YWcsIGkpIHtcclxuXHRcdFx0XHRyZXR1cm4gJC5pbkFycmF5KHRhZywgdGhpcy5fc3RhdGVzLnRhZ3Nbb2JqZWN0Lm5hbWVdKSA9PT0gaTtcclxuXHRcdFx0fSwgdGhpcykpO1xyXG5cdFx0fVxyXG5cdH07XHJcblxyXG5cdC8qKlxyXG5cdCAqIFN1cHByZXNzZXMgZXZlbnRzLlxyXG5cdCAqIEBwcm90ZWN0ZWRcclxuXHQgKiBAcGFyYW0ge0FycmF5LjxTdHJpbmc+fSBldmVudHMgLSBUaGUgZXZlbnRzIHRvIHN1cHByZXNzLlxyXG5cdCAqL1xyXG5cdE93bC5wcm90b3R5cGUuc3VwcHJlc3MgPSBmdW5jdGlvbihldmVudHMpIHtcclxuXHRcdCQuZWFjaChldmVudHMsICQucHJveHkoZnVuY3Rpb24oaW5kZXgsIGV2ZW50KSB7XHJcblx0XHRcdHRoaXMuX3N1cHJlc3NbZXZlbnRdID0gdHJ1ZTtcclxuXHRcdH0sIHRoaXMpKTtcclxuXHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiBSZWxlYXNlcyBzdXBwcmVzc2VkIGV2ZW50cy5cclxuXHQgKiBAcHJvdGVjdGVkXHJcblx0ICogQHBhcmFtIHtBcnJheS48U3RyaW5nPn0gZXZlbnRzIC0gVGhlIGV2ZW50cyB0byByZWxlYXNlLlxyXG5cdCAqL1xyXG5cdE93bC5wcm90b3R5cGUucmVsZWFzZSA9IGZ1bmN0aW9uKGV2ZW50cykge1xyXG5cdFx0JC5lYWNoKGV2ZW50cywgJC5wcm94eShmdW5jdGlvbihpbmRleCwgZXZlbnQpIHtcclxuXHRcdFx0ZGVsZXRlIHRoaXMuX3N1cHJlc3NbZXZlbnRdO1xyXG5cdFx0fSwgdGhpcykpO1xyXG5cdH07XHJcblxyXG5cdC8qKlxyXG5cdCAqIEdldHMgdW5pZmllZCBwb2ludGVyIGNvb3JkaW5hdGVzIGZyb20gZXZlbnQuXHJcblx0ICogQHRvZG8gIzI2MVxyXG5cdCAqIEBwcm90ZWN0ZWRcclxuXHQgKiBAcGFyYW0ge0V2ZW50fSAtIFRoZSBgbW91c2Vkb3duYCBvciBgdG91Y2hzdGFydGAgZXZlbnQuXHJcblx0ICogQHJldHVybnMge09iamVjdH0gLSBDb250YWlucyBgeGAgYW5kIGB5YCBjb29yZGluYXRlcyBvZiBjdXJyZW50IHBvaW50ZXIgcG9zaXRpb24uXHJcblx0ICovXHJcblx0T3dsLnByb3RvdHlwZS5wb2ludGVyID0gZnVuY3Rpb24oZXZlbnQpIHtcclxuXHRcdHZhciByZXN1bHQgPSB7IHg6IG51bGwsIHk6IG51bGwgfTtcclxuXHJcblx0XHRldmVudCA9IGV2ZW50Lm9yaWdpbmFsRXZlbnQgfHwgZXZlbnQgfHwgd2luZG93LmV2ZW50O1xyXG5cclxuXHRcdGV2ZW50ID0gZXZlbnQudG91Y2hlcyAmJiBldmVudC50b3VjaGVzLmxlbmd0aCA/XHJcblx0XHRcdGV2ZW50LnRvdWNoZXNbMF0gOiBldmVudC5jaGFuZ2VkVG91Y2hlcyAmJiBldmVudC5jaGFuZ2VkVG91Y2hlcy5sZW5ndGggP1xyXG5cdFx0XHRcdGV2ZW50LmNoYW5nZWRUb3VjaGVzWzBdIDogZXZlbnQ7XHJcblxyXG5cdFx0aWYgKGV2ZW50LnBhZ2VYKSB7XHJcblx0XHRcdHJlc3VsdC54ID0gZXZlbnQucGFnZVg7XHJcblx0XHRcdHJlc3VsdC55ID0gZXZlbnQucGFnZVk7XHJcblx0XHR9IGVsc2Uge1xyXG5cdFx0XHRyZXN1bHQueCA9IGV2ZW50LmNsaWVudFg7XHJcblx0XHRcdHJlc3VsdC55ID0gZXZlbnQuY2xpZW50WTtcclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4gcmVzdWx0O1xyXG5cdH07XHJcblxyXG5cdC8qKlxyXG5cdCAqIERldGVybWluZXMgaWYgdGhlIGlucHV0IGlzIGEgTnVtYmVyIG9yIHNvbWV0aGluZyB0aGF0IGNhbiBiZSBjb2VyY2VkIHRvIGEgTnVtYmVyXHJcblx0ICogQHByb3RlY3RlZFxyXG5cdCAqIEBwYXJhbSB7TnVtYmVyfFN0cmluZ3xPYmplY3R8QXJyYXl8Qm9vbGVhbnxSZWdFeHB8RnVuY3Rpb258U3ltYm9sfSAtIFRoZSBpbnB1dCB0byBiZSB0ZXN0ZWRcclxuXHQgKiBAcmV0dXJucyB7Qm9vbGVhbn0gLSBBbiBpbmRpY2F0aW9uIGlmIHRoZSBpbnB1dCBpcyBhIE51bWJlciBvciBjYW4gYmUgY29lcmNlZCB0byBhIE51bWJlclxyXG5cdCAqL1xyXG5cdE93bC5wcm90b3R5cGUuaXNOdW1lcmljID0gZnVuY3Rpb24obnVtYmVyKSB7XHJcblx0XHRyZXR1cm4gIWlzTmFOKHBhcnNlRmxvYXQobnVtYmVyKSk7XHJcblx0fTtcclxuXHJcblx0LyoqXHJcblx0ICogR2V0cyB0aGUgZGlmZmVyZW5jZSBvZiB0d28gdmVjdG9ycy5cclxuXHQgKiBAdG9kbyAjMjYxXHJcblx0ICogQHByb3RlY3RlZFxyXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSAtIFRoZSBmaXJzdCB2ZWN0b3IuXHJcblx0ICogQHBhcmFtIHtPYmplY3R9IC0gVGhlIHNlY29uZCB2ZWN0b3IuXHJcblx0ICogQHJldHVybnMge09iamVjdH0gLSBUaGUgZGlmZmVyZW5jZS5cclxuXHQgKi9cclxuXHRPd2wucHJvdG90eXBlLmRpZmZlcmVuY2UgPSBmdW5jdGlvbihmaXJzdCwgc2Vjb25kKSB7XHJcblx0XHRyZXR1cm4ge1xyXG5cdFx0XHR4OiBmaXJzdC54IC0gc2Vjb25kLngsXHJcblx0XHRcdHk6IGZpcnN0LnkgLSBzZWNvbmQueVxyXG5cdFx0fTtcclxuXHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiBUaGUgalF1ZXJ5IFBsdWdpbiBmb3IgdGhlIE93bCBDYXJvdXNlbFxyXG5cdCAqIEB0b2RvIE5hdmlnYXRpb24gcGx1Z2luIGBuZXh0YCBhbmQgYHByZXZgXHJcblx0ICogQHB1YmxpY1xyXG5cdCAqL1xyXG5cdCQuZm4ub3dsQ2Fyb3VzZWwgPSBmdW5jdGlvbihvcHRpb24pIHtcclxuXHRcdHZhciBhcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKTtcclxuXHJcblx0XHRyZXR1cm4gdGhpcy5lYWNoKGZ1bmN0aW9uKCkge1xyXG5cdFx0XHR2YXIgJHRoaXMgPSAkKHRoaXMpLFxyXG5cdFx0XHRcdGRhdGEgPSAkdGhpcy5kYXRhKCdvd2wuY2Fyb3VzZWwnKTtcclxuXHJcblx0XHRcdGlmICghZGF0YSkge1xyXG5cdFx0XHRcdGRhdGEgPSBuZXcgT3dsKHRoaXMsIHR5cGVvZiBvcHRpb24gPT0gJ29iamVjdCcgJiYgb3B0aW9uKTtcclxuXHRcdFx0XHQkdGhpcy5kYXRhKCdvd2wuY2Fyb3VzZWwnLCBkYXRhKTtcclxuXHJcblx0XHRcdFx0JC5lYWNoKFtcclxuXHRcdFx0XHRcdCduZXh0JywgJ3ByZXYnLCAndG8nLCAnZGVzdHJveScsICdyZWZyZXNoJywgJ3JlcGxhY2UnLCAnYWRkJywgJ3JlbW92ZSdcclxuXHRcdFx0XHRdLCBmdW5jdGlvbihpLCBldmVudCkge1xyXG5cdFx0XHRcdFx0ZGF0YS5yZWdpc3Rlcih7IHR5cGU6IE93bC5UeXBlLkV2ZW50LCBuYW1lOiBldmVudCB9KTtcclxuXHRcdFx0XHRcdGRhdGEuJGVsZW1lbnQub24oZXZlbnQgKyAnLm93bC5jYXJvdXNlbC5jb3JlJywgJC5wcm94eShmdW5jdGlvbihlKSB7XHJcblx0XHRcdFx0XHRcdGlmIChlLm5hbWVzcGFjZSAmJiBlLnJlbGF0ZWRUYXJnZXQgIT09IHRoaXMpIHtcclxuXHRcdFx0XHRcdFx0XHR0aGlzLnN1cHByZXNzKFsgZXZlbnQgXSk7XHJcblx0XHRcdFx0XHRcdFx0ZGF0YVtldmVudF0uYXBwbHkodGhpcywgW10uc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpKTtcclxuXHRcdFx0XHRcdFx0XHR0aGlzLnJlbGVhc2UoWyBldmVudCBdKTtcclxuXHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0fSwgZGF0YSkpO1xyXG5cdFx0XHRcdH0pO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRpZiAodHlwZW9mIG9wdGlvbiA9PSAnc3RyaW5nJyAmJiBvcHRpb24uY2hhckF0KDApICE9PSAnXycpIHtcclxuXHRcdFx0XHRkYXRhW29wdGlvbl0uYXBwbHkoZGF0YSwgYXJncyk7XHJcblx0XHRcdH1cclxuXHRcdH0pO1xyXG5cdH07XHJcblxyXG5cdC8qKlxyXG5cdCAqIFRoZSBjb25zdHJ1Y3RvciBmb3IgdGhlIGpRdWVyeSBQbHVnaW5cclxuXHQgKiBAcHVibGljXHJcblx0ICovXHJcblx0JC5mbi5vd2xDYXJvdXNlbC5Db25zdHJ1Y3RvciA9IE93bDtcclxuXHJcbn0pKHdpbmRvdy5aZXB0byB8fCB3aW5kb3cualF1ZXJ5LCB3aW5kb3csIGRvY3VtZW50KTtcclxuXHJcbi8qKlxyXG4gKiBBdXRvUmVmcmVzaCBQbHVnaW5cclxuICogQHZlcnNpb24gMi4zLjRcclxuICogQGF1dGhvciBBcnR1cyBLb2xhbm93c2tpXHJcbiAqIEBhdXRob3IgRGF2aWQgRGV1dHNjaFxyXG4gKiBAbGljZW5zZSBUaGUgTUlUIExpY2Vuc2UgKE1JVClcclxuICovXHJcbjsoZnVuY3Rpb24oJCwgd2luZG93LCBkb2N1bWVudCwgdW5kZWZpbmVkKSB7XHJcblxyXG5cdC8qKlxyXG5cdCAqIENyZWF0ZXMgdGhlIGF1dG8gcmVmcmVzaCBwbHVnaW4uXHJcblx0ICogQGNsYXNzIFRoZSBBdXRvIFJlZnJlc2ggUGx1Z2luXHJcblx0ICogQHBhcmFtIHtPd2x9IGNhcm91c2VsIC0gVGhlIE93bCBDYXJvdXNlbFxyXG5cdCAqL1xyXG5cdHZhciBBdXRvUmVmcmVzaCA9IGZ1bmN0aW9uKGNhcm91c2VsKSB7XHJcblx0XHQvKipcclxuXHRcdCAqIFJlZmVyZW5jZSB0byB0aGUgY29yZS5cclxuXHRcdCAqIEBwcm90ZWN0ZWRcclxuXHRcdCAqIEB0eXBlIHtPd2x9XHJcblx0XHQgKi9cclxuXHRcdHRoaXMuX2NvcmUgPSBjYXJvdXNlbDtcclxuXHJcblx0XHQvKipcclxuXHRcdCAqIFJlZnJlc2ggaW50ZXJ2YWwuXHJcblx0XHQgKiBAcHJvdGVjdGVkXHJcblx0XHQgKiBAdHlwZSB7bnVtYmVyfVxyXG5cdFx0ICovXHJcblx0XHR0aGlzLl9pbnRlcnZhbCA9IG51bGw7XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBXaGV0aGVyIHRoZSBlbGVtZW50IGlzIGN1cnJlbnRseSB2aXNpYmxlIG9yIG5vdC5cclxuXHRcdCAqIEBwcm90ZWN0ZWRcclxuXHRcdCAqIEB0eXBlIHtCb29sZWFufVxyXG5cdFx0ICovXHJcblx0XHR0aGlzLl92aXNpYmxlID0gbnVsbDtcclxuXHJcblx0XHQvKipcclxuXHRcdCAqIEFsbCBldmVudCBoYW5kbGVycy5cclxuXHRcdCAqIEBwcm90ZWN0ZWRcclxuXHRcdCAqIEB0eXBlIHtPYmplY3R9XHJcblx0XHQgKi9cclxuXHRcdHRoaXMuX2hhbmRsZXJzID0ge1xyXG5cdFx0XHQnaW5pdGlhbGl6ZWQub3dsLmNhcm91c2VsJzogJC5wcm94eShmdW5jdGlvbihlKSB7XHJcblx0XHRcdFx0aWYgKGUubmFtZXNwYWNlICYmIHRoaXMuX2NvcmUuc2V0dGluZ3MuYXV0b1JlZnJlc2gpIHtcclxuXHRcdFx0XHRcdHRoaXMud2F0Y2goKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH0sIHRoaXMpXHJcblx0XHR9O1xyXG5cclxuXHRcdC8vIHNldCBkZWZhdWx0IG9wdGlvbnNcclxuXHRcdHRoaXMuX2NvcmUub3B0aW9ucyA9ICQuZXh0ZW5kKHt9LCBBdXRvUmVmcmVzaC5EZWZhdWx0cywgdGhpcy5fY29yZS5vcHRpb25zKTtcclxuXHJcblx0XHQvLyByZWdpc3RlciBldmVudCBoYW5kbGVyc1xyXG5cdFx0dGhpcy5fY29yZS4kZWxlbWVudC5vbih0aGlzLl9oYW5kbGVycyk7XHJcblx0fTtcclxuXHJcblx0LyoqXHJcblx0ICogRGVmYXVsdCBvcHRpb25zLlxyXG5cdCAqIEBwdWJsaWNcclxuXHQgKi9cclxuXHRBdXRvUmVmcmVzaC5EZWZhdWx0cyA9IHtcclxuXHRcdGF1dG9SZWZyZXNoOiB0cnVlLFxyXG5cdFx0YXV0b1JlZnJlc2hJbnRlcnZhbDogNTAwXHJcblx0fTtcclxuXHJcblx0LyoqXHJcblx0ICogV2F0Y2hlcyB0aGUgZWxlbWVudC5cclxuXHQgKi9cclxuXHRBdXRvUmVmcmVzaC5wcm90b3R5cGUud2F0Y2ggPSBmdW5jdGlvbigpIHtcclxuXHRcdGlmICh0aGlzLl9pbnRlcnZhbCkge1xyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblxyXG5cdFx0dGhpcy5fdmlzaWJsZSA9IHRoaXMuX2NvcmUuaXNWaXNpYmxlKCk7XHJcblx0XHR0aGlzLl9pbnRlcnZhbCA9IHdpbmRvdy5zZXRJbnRlcnZhbCgkLnByb3h5KHRoaXMucmVmcmVzaCwgdGhpcyksIHRoaXMuX2NvcmUuc2V0dGluZ3MuYXV0b1JlZnJlc2hJbnRlcnZhbCk7XHJcblx0fTtcclxuXHJcblx0LyoqXHJcblx0ICogUmVmcmVzaGVzIHRoZSBlbGVtZW50LlxyXG5cdCAqL1xyXG5cdEF1dG9SZWZyZXNoLnByb3RvdHlwZS5yZWZyZXNoID0gZnVuY3Rpb24oKSB7XHJcblx0XHRpZiAodGhpcy5fY29yZS5pc1Zpc2libGUoKSA9PT0gdGhpcy5fdmlzaWJsZSkge1xyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblxyXG5cdFx0dGhpcy5fdmlzaWJsZSA9ICF0aGlzLl92aXNpYmxlO1xyXG5cclxuXHRcdHRoaXMuX2NvcmUuJGVsZW1lbnQudG9nZ2xlQ2xhc3MoJ293bC1oaWRkZW4nLCAhdGhpcy5fdmlzaWJsZSk7XHJcblxyXG5cdFx0dGhpcy5fdmlzaWJsZSAmJiAodGhpcy5fY29yZS5pbnZhbGlkYXRlKCd3aWR0aCcpICYmIHRoaXMuX2NvcmUucmVmcmVzaCgpKTtcclxuXHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiBEZXN0cm95cyB0aGUgcGx1Z2luLlxyXG5cdCAqL1xyXG5cdEF1dG9SZWZyZXNoLnByb3RvdHlwZS5kZXN0cm95ID0gZnVuY3Rpb24oKSB7XHJcblx0XHR2YXIgaGFuZGxlciwgcHJvcGVydHk7XHJcblxyXG5cdFx0d2luZG93LmNsZWFySW50ZXJ2YWwodGhpcy5faW50ZXJ2YWwpO1xyXG5cclxuXHRcdGZvciAoaGFuZGxlciBpbiB0aGlzLl9oYW5kbGVycykge1xyXG5cdFx0XHR0aGlzLl9jb3JlLiRlbGVtZW50Lm9mZihoYW5kbGVyLCB0aGlzLl9oYW5kbGVyc1toYW5kbGVyXSk7XHJcblx0XHR9XHJcblx0XHRmb3IgKHByb3BlcnR5IGluIE9iamVjdC5nZXRPd25Qcm9wZXJ0eU5hbWVzKHRoaXMpKSB7XHJcblx0XHRcdHR5cGVvZiB0aGlzW3Byb3BlcnR5XSAhPSAnZnVuY3Rpb24nICYmICh0aGlzW3Byb3BlcnR5XSA9IG51bGwpO1xyXG5cdFx0fVxyXG5cdH07XHJcblxyXG5cdCQuZm4ub3dsQ2Fyb3VzZWwuQ29uc3RydWN0b3IuUGx1Z2lucy5BdXRvUmVmcmVzaCA9IEF1dG9SZWZyZXNoO1xyXG5cclxufSkod2luZG93LlplcHRvIHx8IHdpbmRvdy5qUXVlcnksIHdpbmRvdywgZG9jdW1lbnQpO1xyXG5cclxuLyoqXHJcbiAqIExhenkgUGx1Z2luXHJcbiAqIEB2ZXJzaW9uIDIuMy40XHJcbiAqIEBhdXRob3IgQmFydG9zeiBXb2pjaWVjaG93c2tpXHJcbiAqIEBhdXRob3IgRGF2aWQgRGV1dHNjaFxyXG4gKiBAbGljZW5zZSBUaGUgTUlUIExpY2Vuc2UgKE1JVClcclxuICovXHJcbjsoZnVuY3Rpb24oJCwgd2luZG93LCBkb2N1bWVudCwgdW5kZWZpbmVkKSB7XHJcblxyXG5cdC8qKlxyXG5cdCAqIENyZWF0ZXMgdGhlIGxhenkgcGx1Z2luLlxyXG5cdCAqIEBjbGFzcyBUaGUgTGF6eSBQbHVnaW5cclxuXHQgKiBAcGFyYW0ge093bH0gY2Fyb3VzZWwgLSBUaGUgT3dsIENhcm91c2VsXHJcblx0ICovXHJcblx0dmFyIExhenkgPSBmdW5jdGlvbihjYXJvdXNlbCkge1xyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogUmVmZXJlbmNlIHRvIHRoZSBjb3JlLlxyXG5cdFx0ICogQHByb3RlY3RlZFxyXG5cdFx0ICogQHR5cGUge093bH1cclxuXHRcdCAqL1xyXG5cdFx0dGhpcy5fY29yZSA9IGNhcm91c2VsO1xyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogQWxyZWFkeSBsb2FkZWQgaXRlbXMuXHJcblx0XHQgKiBAcHJvdGVjdGVkXHJcblx0XHQgKiBAdHlwZSB7QXJyYXkuPGpRdWVyeT59XHJcblx0XHQgKi9cclxuXHRcdHRoaXMuX2xvYWRlZCA9IFtdO1xyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogRXZlbnQgaGFuZGxlcnMuXHJcblx0XHQgKiBAcHJvdGVjdGVkXHJcblx0XHQgKiBAdHlwZSB7T2JqZWN0fVxyXG5cdFx0ICovXHJcblx0XHR0aGlzLl9oYW5kbGVycyA9IHtcclxuXHRcdFx0J2luaXRpYWxpemVkLm93bC5jYXJvdXNlbCBjaGFuZ2Uub3dsLmNhcm91c2VsIHJlc2l6ZWQub3dsLmNhcm91c2VsJzogJC5wcm94eShmdW5jdGlvbihlKSB7XHJcblx0XHRcdFx0aWYgKCFlLm5hbWVzcGFjZSkge1xyXG5cdFx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0aWYgKCF0aGlzLl9jb3JlLnNldHRpbmdzIHx8ICF0aGlzLl9jb3JlLnNldHRpbmdzLmxhenlMb2FkKSB7XHJcblx0XHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRpZiAoKGUucHJvcGVydHkgJiYgZS5wcm9wZXJ0eS5uYW1lID09ICdwb3NpdGlvbicpIHx8IGUudHlwZSA9PSAnaW5pdGlhbGl6ZWQnKSB7XHJcblx0XHRcdFx0XHR2YXIgc2V0dGluZ3MgPSB0aGlzLl9jb3JlLnNldHRpbmdzLFxyXG5cdFx0XHRcdFx0XHRuID0gKHNldHRpbmdzLmNlbnRlciAmJiBNYXRoLmNlaWwoc2V0dGluZ3MuaXRlbXMgLyAyKSB8fCBzZXR0aW5ncy5pdGVtcyksXHJcblx0XHRcdFx0XHRcdGkgPSAoKHNldHRpbmdzLmNlbnRlciAmJiBuICogLTEpIHx8IDApLFxyXG5cdFx0XHRcdFx0XHRwb3NpdGlvbiA9IChlLnByb3BlcnR5ICYmIGUucHJvcGVydHkudmFsdWUgIT09IHVuZGVmaW5lZCA/IGUucHJvcGVydHkudmFsdWUgOiB0aGlzLl9jb3JlLmN1cnJlbnQoKSkgKyBpLFxyXG5cdFx0XHRcdFx0XHRjbG9uZXMgPSB0aGlzLl9jb3JlLmNsb25lcygpLmxlbmd0aCxcclxuXHRcdFx0XHRcdFx0bG9hZCA9ICQucHJveHkoZnVuY3Rpb24oaSwgdikgeyB0aGlzLmxvYWQodikgfSwgdGhpcyk7XHJcblx0XHRcdFx0XHQvL1RPRE86IE5lZWQgZG9jdW1lbnRhdGlvbiBmb3IgdGhpcyBuZXcgb3B0aW9uXHJcblx0XHRcdFx0XHRpZiAoc2V0dGluZ3MubGF6eUxvYWRFYWdlciA+IDApIHtcclxuXHRcdFx0XHRcdFx0biArPSBzZXR0aW5ncy5sYXp5TG9hZEVhZ2VyO1xyXG5cdFx0XHRcdFx0XHQvLyBJZiB0aGUgY2Fyb3VzZWwgaXMgbG9vcGluZyBhbHNvIHByZWxvYWQgaW1hZ2VzIHRoYXQgYXJlIHRvIHRoZSBcImxlZnRcIlxyXG5cdFx0XHRcdFx0XHRpZiAoc2V0dGluZ3MubG9vcCkge1xyXG4gICAgICAgICAgICAgIHBvc2l0aW9uIC09IHNldHRpbmdzLmxhenlMb2FkRWFnZXI7XHJcbiAgICAgICAgICAgICAgbisrO1xyXG4gICAgICAgICAgICB9XHJcblx0XHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdFx0d2hpbGUgKGkrKyA8IG4pIHtcclxuXHRcdFx0XHRcdFx0dGhpcy5sb2FkKGNsb25lcyAvIDIgKyB0aGlzLl9jb3JlLnJlbGF0aXZlKHBvc2l0aW9uKSk7XHJcblx0XHRcdFx0XHRcdGNsb25lcyAmJiAkLmVhY2godGhpcy5fY29yZS5jbG9uZXModGhpcy5fY29yZS5yZWxhdGl2ZShwb3NpdGlvbikpLCBsb2FkKTtcclxuXHRcdFx0XHRcdFx0cG9zaXRpb24rKztcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHR9XHJcblx0XHRcdH0sIHRoaXMpXHJcblx0XHR9O1xyXG5cclxuXHRcdC8vIHNldCB0aGUgZGVmYXVsdCBvcHRpb25zXHJcblx0XHR0aGlzLl9jb3JlLm9wdGlvbnMgPSAkLmV4dGVuZCh7fSwgTGF6eS5EZWZhdWx0cywgdGhpcy5fY29yZS5vcHRpb25zKTtcclxuXHJcblx0XHQvLyByZWdpc3RlciBldmVudCBoYW5kbGVyXHJcblx0XHR0aGlzLl9jb3JlLiRlbGVtZW50Lm9uKHRoaXMuX2hhbmRsZXJzKTtcclxuXHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiBEZWZhdWx0IG9wdGlvbnMuXHJcblx0ICogQHB1YmxpY1xyXG5cdCAqL1xyXG5cdExhenkuRGVmYXVsdHMgPSB7XHJcblx0XHRsYXp5TG9hZDogZmFsc2UsXHJcblx0XHRsYXp5TG9hZEVhZ2VyOiAwXHJcblx0fTtcclxuXHJcblx0LyoqXHJcblx0ICogTG9hZHMgYWxsIHJlc291cmNlcyBvZiBhbiBpdGVtIGF0IHRoZSBzcGVjaWZpZWQgcG9zaXRpb24uXHJcblx0ICogQHBhcmFtIHtOdW1iZXJ9IHBvc2l0aW9uIC0gVGhlIGFic29sdXRlIHBvc2l0aW9uIG9mIHRoZSBpdGVtLlxyXG5cdCAqIEBwcm90ZWN0ZWRcclxuXHQgKi9cclxuXHRMYXp5LnByb3RvdHlwZS5sb2FkID0gZnVuY3Rpb24ocG9zaXRpb24pIHtcclxuXHRcdHZhciAkaXRlbSA9IHRoaXMuX2NvcmUuJHN0YWdlLmNoaWxkcmVuKCkuZXEocG9zaXRpb24pLFxyXG5cdFx0XHQkZWxlbWVudHMgPSAkaXRlbSAmJiAkaXRlbS5maW5kKCcub3dsLWxhenknKTtcclxuXHJcblx0XHRpZiAoISRlbGVtZW50cyB8fCAkLmluQXJyYXkoJGl0ZW0uZ2V0KDApLCB0aGlzLl9sb2FkZWQpID4gLTEpIHtcclxuXHRcdFx0cmV0dXJuO1xyXG5cdFx0fVxyXG5cclxuXHRcdCRlbGVtZW50cy5lYWNoKCQucHJveHkoZnVuY3Rpb24oaW5kZXgsIGVsZW1lbnQpIHtcclxuXHRcdFx0dmFyICRlbGVtZW50ID0gJChlbGVtZW50KSwgaW1hZ2UsXHJcbiAgICAgICAgICAgICAgICB1cmwgPSAod2luZG93LmRldmljZVBpeGVsUmF0aW8gPiAxICYmICRlbGVtZW50LmF0dHIoJ2RhdGEtc3JjLXJldGluYScpKSB8fCAkZWxlbWVudC5hdHRyKCdkYXRhLXNyYycpIHx8ICRlbGVtZW50LmF0dHIoJ2RhdGEtc3Jjc2V0Jyk7XHJcblxyXG5cdFx0XHR0aGlzLl9jb3JlLnRyaWdnZXIoJ2xvYWQnLCB7IGVsZW1lbnQ6ICRlbGVtZW50LCB1cmw6IHVybCB9LCAnbGF6eScpO1xyXG5cclxuXHRcdFx0aWYgKCRlbGVtZW50LmlzKCdpbWcnKSkge1xyXG5cdFx0XHRcdCRlbGVtZW50Lm9uZSgnbG9hZC5vd2wubGF6eScsICQucHJveHkoZnVuY3Rpb24oKSB7XHJcblx0XHRcdFx0XHQkZWxlbWVudC5jc3MoJ29wYWNpdHknLCAxKTtcclxuXHRcdFx0XHRcdHRoaXMuX2NvcmUudHJpZ2dlcignbG9hZGVkJywgeyBlbGVtZW50OiAkZWxlbWVudCwgdXJsOiB1cmwgfSwgJ2xhenknKTtcclxuXHRcdFx0XHR9LCB0aGlzKSkuYXR0cignc3JjJywgdXJsKTtcclxuICAgICAgICAgICAgfSBlbHNlIGlmICgkZWxlbWVudC5pcygnc291cmNlJykpIHtcclxuICAgICAgICAgICAgICAgICRlbGVtZW50Lm9uZSgnbG9hZC5vd2wubGF6eScsICQucHJveHkoZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fY29yZS50cmlnZ2VyKCdsb2FkZWQnLCB7IGVsZW1lbnQ6ICRlbGVtZW50LCB1cmw6IHVybCB9LCAnbGF6eScpO1xyXG4gICAgICAgICAgICAgICAgfSwgdGhpcykpLmF0dHIoJ3NyY3NldCcsIHVybCk7XHJcblx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0aW1hZ2UgPSBuZXcgSW1hZ2UoKTtcclxuXHRcdFx0XHRpbWFnZS5vbmxvYWQgPSAkLnByb3h5KGZ1bmN0aW9uKCkge1xyXG5cdFx0XHRcdFx0JGVsZW1lbnQuY3NzKHtcclxuXHRcdFx0XHRcdFx0J2JhY2tncm91bmQtaW1hZ2UnOiAndXJsKFwiJyArIHVybCArICdcIiknLFxyXG5cdFx0XHRcdFx0XHQnb3BhY2l0eSc6ICcxJ1xyXG5cdFx0XHRcdFx0fSk7XHJcblx0XHRcdFx0XHR0aGlzLl9jb3JlLnRyaWdnZXIoJ2xvYWRlZCcsIHsgZWxlbWVudDogJGVsZW1lbnQsIHVybDogdXJsIH0sICdsYXp5Jyk7XHJcblx0XHRcdFx0fSwgdGhpcyk7XHJcblx0XHRcdFx0aW1hZ2Uuc3JjID0gdXJsO1xyXG5cdFx0XHR9XHJcblx0XHR9LCB0aGlzKSk7XHJcblxyXG5cdFx0dGhpcy5fbG9hZGVkLnB1c2goJGl0ZW0uZ2V0KDApKTtcclxuXHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiBEZXN0cm95cyB0aGUgcGx1Z2luLlxyXG5cdCAqIEBwdWJsaWNcclxuXHQgKi9cclxuXHRMYXp5LnByb3RvdHlwZS5kZXN0cm95ID0gZnVuY3Rpb24oKSB7XHJcblx0XHR2YXIgaGFuZGxlciwgcHJvcGVydHk7XHJcblxyXG5cdFx0Zm9yIChoYW5kbGVyIGluIHRoaXMuaGFuZGxlcnMpIHtcclxuXHRcdFx0dGhpcy5fY29yZS4kZWxlbWVudC5vZmYoaGFuZGxlciwgdGhpcy5oYW5kbGVyc1toYW5kbGVyXSk7XHJcblx0XHR9XHJcblx0XHRmb3IgKHByb3BlcnR5IGluIE9iamVjdC5nZXRPd25Qcm9wZXJ0eU5hbWVzKHRoaXMpKSB7XHJcblx0XHRcdHR5cGVvZiB0aGlzW3Byb3BlcnR5XSAhPSAnZnVuY3Rpb24nICYmICh0aGlzW3Byb3BlcnR5XSA9IG51bGwpO1xyXG5cdFx0fVxyXG5cdH07XHJcblxyXG5cdCQuZm4ub3dsQ2Fyb3VzZWwuQ29uc3RydWN0b3IuUGx1Z2lucy5MYXp5ID0gTGF6eTtcclxuXHJcbn0pKHdpbmRvdy5aZXB0byB8fCB3aW5kb3cualF1ZXJ5LCB3aW5kb3csIGRvY3VtZW50KTtcclxuXHJcbi8qKlxyXG4gKiBBdXRvSGVpZ2h0IFBsdWdpblxyXG4gKiBAdmVyc2lvbiAyLjMuNFxyXG4gKiBAYXV0aG9yIEJhcnRvc3ogV29qY2llY2hvd3NraVxyXG4gKiBAYXV0aG9yIERhdmlkIERldXRzY2hcclxuICogQGxpY2Vuc2UgVGhlIE1JVCBMaWNlbnNlIChNSVQpXHJcbiAqL1xyXG47KGZ1bmN0aW9uKCQsIHdpbmRvdywgZG9jdW1lbnQsIHVuZGVmaW5lZCkge1xyXG5cclxuXHQvKipcclxuXHQgKiBDcmVhdGVzIHRoZSBhdXRvIGhlaWdodCBwbHVnaW4uXHJcblx0ICogQGNsYXNzIFRoZSBBdXRvIEhlaWdodCBQbHVnaW5cclxuXHQgKiBAcGFyYW0ge093bH0gY2Fyb3VzZWwgLSBUaGUgT3dsIENhcm91c2VsXHJcblx0ICovXHJcblx0dmFyIEF1dG9IZWlnaHQgPSBmdW5jdGlvbihjYXJvdXNlbCkge1xyXG5cdFx0LyoqXHJcblx0XHQgKiBSZWZlcmVuY2UgdG8gdGhlIGNvcmUuXHJcblx0XHQgKiBAcHJvdGVjdGVkXHJcblx0XHQgKiBAdHlwZSB7T3dsfVxyXG5cdFx0ICovXHJcblx0XHR0aGlzLl9jb3JlID0gY2Fyb3VzZWw7XHJcblxyXG5cdFx0dGhpcy5fcHJldmlvdXNIZWlnaHQgPSBudWxsO1xyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogQWxsIGV2ZW50IGhhbmRsZXJzLlxyXG5cdFx0ICogQHByb3RlY3RlZFxyXG5cdFx0ICogQHR5cGUge09iamVjdH1cclxuXHRcdCAqL1xyXG5cdFx0dGhpcy5faGFuZGxlcnMgPSB7XHJcblx0XHRcdCdpbml0aWFsaXplZC5vd2wuY2Fyb3VzZWwgcmVmcmVzaGVkLm93bC5jYXJvdXNlbCc6ICQucHJveHkoZnVuY3Rpb24oZSkge1xyXG5cdFx0XHRcdGlmIChlLm5hbWVzcGFjZSAmJiB0aGlzLl9jb3JlLnNldHRpbmdzLmF1dG9IZWlnaHQpIHtcclxuXHRcdFx0XHRcdHRoaXMudXBkYXRlKCk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9LCB0aGlzKSxcclxuXHRcdFx0J2NoYW5nZWQub3dsLmNhcm91c2VsJzogJC5wcm94eShmdW5jdGlvbihlKSB7XHJcblx0XHRcdFx0aWYgKGUubmFtZXNwYWNlICYmIHRoaXMuX2NvcmUuc2V0dGluZ3MuYXV0b0hlaWdodCAmJiBlLnByb3BlcnR5Lm5hbWUgPT09ICdwb3NpdGlvbicpe1xyXG5cdFx0XHRcdFx0dGhpcy51cGRhdGUoKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH0sIHRoaXMpLFxyXG5cdFx0XHQnbG9hZGVkLm93bC5sYXp5JzogJC5wcm94eShmdW5jdGlvbihlKSB7XHJcblx0XHRcdFx0aWYgKGUubmFtZXNwYWNlICYmIHRoaXMuX2NvcmUuc2V0dGluZ3MuYXV0b0hlaWdodFxyXG5cdFx0XHRcdFx0JiYgZS5lbGVtZW50LmNsb3Nlc3QoJy4nICsgdGhpcy5fY29yZS5zZXR0aW5ncy5pdGVtQ2xhc3MpLmluZGV4KCkgPT09IHRoaXMuX2NvcmUuY3VycmVudCgpKSB7XHJcblx0XHRcdFx0XHR0aGlzLnVwZGF0ZSgpO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fSwgdGhpcylcclxuXHRcdH07XHJcblxyXG5cdFx0Ly8gc2V0IGRlZmF1bHQgb3B0aW9uc1xyXG5cdFx0dGhpcy5fY29yZS5vcHRpb25zID0gJC5leHRlbmQoe30sIEF1dG9IZWlnaHQuRGVmYXVsdHMsIHRoaXMuX2NvcmUub3B0aW9ucyk7XHJcblxyXG5cdFx0Ly8gcmVnaXN0ZXIgZXZlbnQgaGFuZGxlcnNcclxuXHRcdHRoaXMuX2NvcmUuJGVsZW1lbnQub24odGhpcy5faGFuZGxlcnMpO1xyXG5cdFx0dGhpcy5faW50ZXJ2YWxJZCA9IG51bGw7XHJcblx0XHR2YXIgcmVmVGhpcyA9IHRoaXM7XHJcblxyXG5cdFx0Ly8gVGhlc2UgY2hhbmdlcyBoYXZlIGJlZW4gdGFrZW4gZnJvbSBhIFBSIGJ5IGdhdnJvY2hlbGVnbm91IHByb3Bvc2VkIGluICMxNTc1XHJcblx0XHQvLyBhbmQgaGF2ZSBiZWVuIG1hZGUgY29tcGF0aWJsZSB3aXRoIHRoZSBsYXRlc3QgalF1ZXJ5IHZlcnNpb25cclxuXHRcdCQod2luZG93KS5vbignbG9hZCcsIGZ1bmN0aW9uKCkge1xyXG5cdFx0XHRpZiAocmVmVGhpcy5fY29yZS5zZXR0aW5ncy5hdXRvSGVpZ2h0KSB7XHJcblx0XHRcdFx0cmVmVGhpcy51cGRhdGUoKTtcclxuXHRcdFx0fVxyXG5cdFx0fSk7XHJcblxyXG5cdFx0Ly8gQXV0b3Jlc2l6ZSB0aGUgaGVpZ2h0IG9mIHRoZSBjYXJvdXNlbCB3aGVuIHdpbmRvdyBpcyByZXNpemVkXHJcblx0XHQvLyBXaGVuIGNhcm91c2VsIGhhcyBpbWFnZXMsIHRoZSBoZWlnaHQgaXMgZGVwZW5kZW50IG9uIHRoZSB3aWR0aFxyXG5cdFx0Ly8gYW5kIHNob3VsZCBhbHNvIGNoYW5nZSBvbiByZXNpemVcclxuXHRcdCQod2luZG93KS5yZXNpemUoZnVuY3Rpb24oKSB7XHJcblx0XHRcdGlmIChyZWZUaGlzLl9jb3JlLnNldHRpbmdzLmF1dG9IZWlnaHQpIHtcclxuXHRcdFx0XHRpZiAocmVmVGhpcy5faW50ZXJ2YWxJZCAhPSBudWxsKSB7XHJcblx0XHRcdFx0XHRjbGVhclRpbWVvdXQocmVmVGhpcy5faW50ZXJ2YWxJZCk7XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRyZWZUaGlzLl9pbnRlcnZhbElkID0gc2V0VGltZW91dChmdW5jdGlvbigpIHtcclxuXHRcdFx0XHRcdHJlZlRoaXMudXBkYXRlKCk7XHJcblx0XHRcdFx0fSwgMjUwKTtcclxuXHRcdFx0fVxyXG5cdFx0fSk7XHJcblxyXG5cdH07XHJcblxyXG5cdC8qKlxyXG5cdCAqIERlZmF1bHQgb3B0aW9ucy5cclxuXHQgKiBAcHVibGljXHJcblx0ICovXHJcblx0QXV0b0hlaWdodC5EZWZhdWx0cyA9IHtcclxuXHRcdGF1dG9IZWlnaHQ6IGZhbHNlLFxyXG5cdFx0YXV0b0hlaWdodENsYXNzOiAnb3dsLWhlaWdodCdcclxuXHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiBVcGRhdGVzIHRoZSB2aWV3LlxyXG5cdCAqL1xyXG5cdEF1dG9IZWlnaHQucHJvdG90eXBlLnVwZGF0ZSA9IGZ1bmN0aW9uKCkge1xyXG5cdFx0dmFyIHN0YXJ0ID0gdGhpcy5fY29yZS5fY3VycmVudCxcclxuXHRcdFx0ZW5kID0gc3RhcnQgKyB0aGlzLl9jb3JlLnNldHRpbmdzLml0ZW1zLFxyXG5cdFx0XHRsYXp5TG9hZEVuYWJsZWQgPSB0aGlzLl9jb3JlLnNldHRpbmdzLmxhenlMb2FkLFxyXG5cdFx0XHR2aXNpYmxlID0gdGhpcy5fY29yZS4kc3RhZ2UuY2hpbGRyZW4oKS50b0FycmF5KCkuc2xpY2Uoc3RhcnQsIGVuZCksXHJcblx0XHRcdGhlaWdodHMgPSBbXSxcclxuXHRcdFx0bWF4aGVpZ2h0ID0gMDtcclxuXHJcblx0XHQkLmVhY2godmlzaWJsZSwgZnVuY3Rpb24oaW5kZXgsIGl0ZW0pIHtcclxuXHRcdFx0aGVpZ2h0cy5wdXNoKCQoaXRlbSkuaGVpZ2h0KCkpO1xyXG5cdFx0fSk7XHJcblxyXG5cdFx0bWF4aGVpZ2h0ID0gTWF0aC5tYXguYXBwbHkobnVsbCwgaGVpZ2h0cyk7XHJcblxyXG5cdFx0aWYgKG1heGhlaWdodCA8PSAxICYmIGxhenlMb2FkRW5hYmxlZCAmJiB0aGlzLl9wcmV2aW91c0hlaWdodCkge1xyXG5cdFx0XHRtYXhoZWlnaHQgPSB0aGlzLl9wcmV2aW91c0hlaWdodDtcclxuXHRcdH1cclxuXHJcblx0XHR0aGlzLl9wcmV2aW91c0hlaWdodCA9IG1heGhlaWdodDtcclxuXHJcblx0XHR0aGlzLl9jb3JlLiRzdGFnZS5wYXJlbnQoKVxyXG5cdFx0XHQuaGVpZ2h0KG1heGhlaWdodClcclxuXHRcdFx0LmFkZENsYXNzKHRoaXMuX2NvcmUuc2V0dGluZ3MuYXV0b0hlaWdodENsYXNzKTtcclxuXHR9O1xyXG5cclxuXHRBdXRvSGVpZ2h0LnByb3RvdHlwZS5kZXN0cm95ID0gZnVuY3Rpb24oKSB7XHJcblx0XHR2YXIgaGFuZGxlciwgcHJvcGVydHk7XHJcblxyXG5cdFx0Zm9yIChoYW5kbGVyIGluIHRoaXMuX2hhbmRsZXJzKSB7XHJcblx0XHRcdHRoaXMuX2NvcmUuJGVsZW1lbnQub2ZmKGhhbmRsZXIsIHRoaXMuX2hhbmRsZXJzW2hhbmRsZXJdKTtcclxuXHRcdH1cclxuXHRcdGZvciAocHJvcGVydHkgaW4gT2JqZWN0LmdldE93blByb3BlcnR5TmFtZXModGhpcykpIHtcclxuXHRcdFx0dHlwZW9mIHRoaXNbcHJvcGVydHldICE9PSAnZnVuY3Rpb24nICYmICh0aGlzW3Byb3BlcnR5XSA9IG51bGwpO1xyXG5cdFx0fVxyXG5cdH07XHJcblxyXG5cdCQuZm4ub3dsQ2Fyb3VzZWwuQ29uc3RydWN0b3IuUGx1Z2lucy5BdXRvSGVpZ2h0ID0gQXV0b0hlaWdodDtcclxuXHJcbn0pKHdpbmRvdy5aZXB0byB8fCB3aW5kb3cualF1ZXJ5LCB3aW5kb3csIGRvY3VtZW50KTtcclxuXHJcbi8qKlxyXG4gKiBWaWRlbyBQbHVnaW5cclxuICogQHZlcnNpb24gMi4zLjRcclxuICogQGF1dGhvciBCYXJ0b3N6IFdvamNpZWNob3dza2lcclxuICogQGF1dGhvciBEYXZpZCBEZXV0c2NoXHJcbiAqIEBsaWNlbnNlIFRoZSBNSVQgTGljZW5zZSAoTUlUKVxyXG4gKi9cclxuOyhmdW5jdGlvbigkLCB3aW5kb3csIGRvY3VtZW50LCB1bmRlZmluZWQpIHtcclxuXHJcblx0LyoqXHJcblx0ICogQ3JlYXRlcyB0aGUgdmlkZW8gcGx1Z2luLlxyXG5cdCAqIEBjbGFzcyBUaGUgVmlkZW8gUGx1Z2luXHJcblx0ICogQHBhcmFtIHtPd2x9IGNhcm91c2VsIC0gVGhlIE93bCBDYXJvdXNlbFxyXG5cdCAqL1xyXG5cdHZhciBWaWRlbyA9IGZ1bmN0aW9uKGNhcm91c2VsKSB7XHJcblx0XHQvKipcclxuXHRcdCAqIFJlZmVyZW5jZSB0byB0aGUgY29yZS5cclxuXHRcdCAqIEBwcm90ZWN0ZWRcclxuXHRcdCAqIEB0eXBlIHtPd2x9XHJcblx0XHQgKi9cclxuXHRcdHRoaXMuX2NvcmUgPSBjYXJvdXNlbDtcclxuXHJcblx0XHQvKipcclxuXHRcdCAqIENhY2hlIGFsbCB2aWRlbyBVUkxzLlxyXG5cdFx0ICogQHByb3RlY3RlZFxyXG5cdFx0ICogQHR5cGUge09iamVjdH1cclxuXHRcdCAqL1xyXG5cdFx0dGhpcy5fdmlkZW9zID0ge307XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBDdXJyZW50IHBsYXlpbmcgaXRlbS5cclxuXHRcdCAqIEBwcm90ZWN0ZWRcclxuXHRcdCAqIEB0eXBlIHtqUXVlcnl9XHJcblx0XHQgKi9cclxuXHRcdHRoaXMuX3BsYXlpbmcgPSBudWxsO1xyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogQWxsIGV2ZW50IGhhbmRsZXJzLlxyXG5cdFx0ICogQHRvZG8gVGhlIGNsb25lZCBjb250ZW50IHJlbW92YWxlIGlzIHRvbyBsYXRlXHJcblx0XHQgKiBAcHJvdGVjdGVkXHJcblx0XHQgKiBAdHlwZSB7T2JqZWN0fVxyXG5cdFx0ICovXHJcblx0XHR0aGlzLl9oYW5kbGVycyA9IHtcclxuXHRcdFx0J2luaXRpYWxpemVkLm93bC5jYXJvdXNlbCc6ICQucHJveHkoZnVuY3Rpb24oZSkge1xyXG5cdFx0XHRcdGlmIChlLm5hbWVzcGFjZSkge1xyXG5cdFx0XHRcdFx0dGhpcy5fY29yZS5yZWdpc3Rlcih7IHR5cGU6ICdzdGF0ZScsIG5hbWU6ICdwbGF5aW5nJywgdGFnczogWyAnaW50ZXJhY3RpbmcnIF0gfSk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9LCB0aGlzKSxcclxuXHRcdFx0J3Jlc2l6ZS5vd2wuY2Fyb3VzZWwnOiAkLnByb3h5KGZ1bmN0aW9uKGUpIHtcclxuXHRcdFx0XHRpZiAoZS5uYW1lc3BhY2UgJiYgdGhpcy5fY29yZS5zZXR0aW5ncy52aWRlbyAmJiB0aGlzLmlzSW5GdWxsU2NyZWVuKCkpIHtcclxuXHRcdFx0XHRcdGUucHJldmVudERlZmF1bHQoKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH0sIHRoaXMpLFxyXG5cdFx0XHQncmVmcmVzaGVkLm93bC5jYXJvdXNlbCc6ICQucHJveHkoZnVuY3Rpb24oZSkge1xyXG5cdFx0XHRcdGlmIChlLm5hbWVzcGFjZSAmJiB0aGlzLl9jb3JlLmlzKCdyZXNpemluZycpKSB7XHJcblx0XHRcdFx0XHR0aGlzLl9jb3JlLiRzdGFnZS5maW5kKCcuY2xvbmVkIC5vd2wtdmlkZW8tZnJhbWUnKS5yZW1vdmUoKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH0sIHRoaXMpLFxyXG5cdFx0XHQnY2hhbmdlZC5vd2wuY2Fyb3VzZWwnOiAkLnByb3h5KGZ1bmN0aW9uKGUpIHtcclxuXHRcdFx0XHRpZiAoZS5uYW1lc3BhY2UgJiYgZS5wcm9wZXJ0eS5uYW1lID09PSAncG9zaXRpb24nICYmIHRoaXMuX3BsYXlpbmcpIHtcclxuXHRcdFx0XHRcdHRoaXMuc3RvcCgpO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fSwgdGhpcyksXHJcblx0XHRcdCdwcmVwYXJlZC5vd2wuY2Fyb3VzZWwnOiAkLnByb3h5KGZ1bmN0aW9uKGUpIHtcclxuXHRcdFx0XHRpZiAoIWUubmFtZXNwYWNlKSB7XHJcblx0XHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHR2YXIgJGVsZW1lbnQgPSAkKGUuY29udGVudCkuZmluZCgnLm93bC12aWRlbycpO1xyXG5cclxuXHRcdFx0XHRpZiAoJGVsZW1lbnQubGVuZ3RoKSB7XHJcblx0XHRcdFx0XHQkZWxlbWVudC5jc3MoJ2Rpc3BsYXknLCAnbm9uZScpO1xyXG5cdFx0XHRcdFx0dGhpcy5mZXRjaCgkZWxlbWVudCwgJChlLmNvbnRlbnQpKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH0sIHRoaXMpXHJcblx0XHR9O1xyXG5cclxuXHRcdC8vIHNldCBkZWZhdWx0IG9wdGlvbnNcclxuXHRcdHRoaXMuX2NvcmUub3B0aW9ucyA9ICQuZXh0ZW5kKHt9LCBWaWRlby5EZWZhdWx0cywgdGhpcy5fY29yZS5vcHRpb25zKTtcclxuXHJcblx0XHQvLyByZWdpc3RlciBldmVudCBoYW5kbGVyc1xyXG5cdFx0dGhpcy5fY29yZS4kZWxlbWVudC5vbih0aGlzLl9oYW5kbGVycyk7XHJcblxyXG5cdFx0dGhpcy5fY29yZS4kZWxlbWVudC5vbignY2xpY2sub3dsLnZpZGVvJywgJy5vd2wtdmlkZW8tcGxheS1pY29uJywgJC5wcm94eShmdW5jdGlvbihlKSB7XHJcblx0XHRcdHRoaXMucGxheShlKTtcclxuXHRcdH0sIHRoaXMpKTtcclxuXHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiBEZWZhdWx0IG9wdGlvbnMuXHJcblx0ICogQHB1YmxpY1xyXG5cdCAqL1xyXG5cdFZpZGVvLkRlZmF1bHRzID0ge1xyXG5cdFx0dmlkZW86IGZhbHNlLFxyXG5cdFx0dmlkZW9IZWlnaHQ6IGZhbHNlLFxyXG5cdFx0dmlkZW9XaWR0aDogZmFsc2VcclxuXHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiBHZXRzIHRoZSB2aWRlbyBJRCBhbmQgdGhlIHR5cGUgKFlvdVR1YmUvVmltZW8vdnphYXIgb25seSkuXHJcblx0ICogQHByb3RlY3RlZFxyXG5cdCAqIEBwYXJhbSB7alF1ZXJ5fSB0YXJnZXQgLSBUaGUgdGFyZ2V0IGNvbnRhaW5pbmcgdGhlIHZpZGVvIGRhdGEuXHJcblx0ICogQHBhcmFtIHtqUXVlcnl9IGl0ZW0gLSBUaGUgaXRlbSBjb250YWluaW5nIHRoZSB2aWRlby5cclxuXHQgKi9cclxuXHRWaWRlby5wcm90b3R5cGUuZmV0Y2ggPSBmdW5jdGlvbih0YXJnZXQsIGl0ZW0pIHtcclxuXHRcdFx0dmFyIHR5cGUgPSAoZnVuY3Rpb24oKSB7XHJcblx0XHRcdFx0XHRpZiAodGFyZ2V0LmF0dHIoJ2RhdGEtdmltZW8taWQnKSkge1xyXG5cdFx0XHRcdFx0XHRyZXR1cm4gJ3ZpbWVvJztcclxuXHRcdFx0XHRcdH0gZWxzZSBpZiAodGFyZ2V0LmF0dHIoJ2RhdGEtdnphYXItaWQnKSkge1xyXG5cdFx0XHRcdFx0XHRyZXR1cm4gJ3Z6YWFyJ1xyXG5cdFx0XHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRcdFx0cmV0dXJuICd5b3V0dWJlJztcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHR9KSgpLFxyXG5cdFx0XHRcdGlkID0gdGFyZ2V0LmF0dHIoJ2RhdGEtdmltZW8taWQnKSB8fCB0YXJnZXQuYXR0cignZGF0YS15b3V0dWJlLWlkJykgfHwgdGFyZ2V0LmF0dHIoJ2RhdGEtdnphYXItaWQnKSxcclxuXHRcdFx0XHR3aWR0aCA9IHRhcmdldC5hdHRyKCdkYXRhLXdpZHRoJykgfHwgdGhpcy5fY29yZS5zZXR0aW5ncy52aWRlb1dpZHRoLFxyXG5cdFx0XHRcdGhlaWdodCA9IHRhcmdldC5hdHRyKCdkYXRhLWhlaWdodCcpIHx8IHRoaXMuX2NvcmUuc2V0dGluZ3MudmlkZW9IZWlnaHQsXHJcblx0XHRcdFx0dXJsID0gdGFyZ2V0LmF0dHIoJ2hyZWYnKTtcclxuXHJcblx0XHRpZiAodXJsKSB7XHJcblxyXG5cdFx0XHQvKlxyXG5cdFx0XHRcdFx0UGFyc2VzIHRoZSBpZCdzIG91dCBvZiB0aGUgZm9sbG93aW5nIHVybHMgKGFuZCBwcm9iYWJseSBtb3JlKTpcclxuXHRcdFx0XHRcdGh0dHBzOi8vd3d3LnlvdXR1YmUuY29tL3dhdGNoP3Y9OmlkXHJcblx0XHRcdFx0XHRodHRwczovL3lvdXR1LmJlLzppZFxyXG5cdFx0XHRcdFx0aHR0cHM6Ly92aW1lby5jb20vOmlkXHJcblx0XHRcdFx0XHRodHRwczovL3ZpbWVvLmNvbS9jaGFubmVscy86Y2hhbm5lbC86aWRcclxuXHRcdFx0XHRcdGh0dHBzOi8vdmltZW8uY29tL2dyb3Vwcy86Z3JvdXAvdmlkZW9zLzppZFxyXG5cdFx0XHRcdFx0aHR0cHM6Ly9hcHAudnphYXIuY29tL3ZpZGVvcy86aWRcclxuXHJcblx0XHRcdFx0XHRWaXN1YWwgZXhhbXBsZTogaHR0cHM6Ly9yZWdleHBlci5jb20vIyhodHRwJTNBJTdDaHR0cHMlM0ElN0MpJTVDJTJGJTVDJTJGKHBsYXllci4lN0N3d3cuJTdDYXBwLiklM0YodmltZW8lNUMuY29tJTdDeW91dHUoYmUlNUMuY29tJTdDJTVDLmJlJTdDYmUlNUMuZ29vZ2xlYXBpcyU1Qy5jb20pJTdDdnphYXIlNUMuY29tKSU1QyUyRih2aWRlbyU1QyUyRiU3Q3ZpZGVvcyU1QyUyRiU3Q2VtYmVkJTVDJTJGJTdDY2hhbm5lbHMlNUMlMkYuJTJCJTVDJTJGJTdDZ3JvdXBzJTVDJTJGLiUyQiU1QyUyRiU3Q3dhdGNoJTVDJTNGdiUzRCU3Q3YlNUMlMkYpJTNGKCU1QkEtWmEtejAtOS5fJTI1LSU1RCopKCU1QyUyNiU1Q1MlMkIpJTNGXHJcblx0XHRcdCovXHJcblxyXG5cdFx0XHRpZCA9IHVybC5tYXRjaCgvKGh0dHA6fGh0dHBzOnwpXFwvXFwvKHBsYXllci58d3d3LnxhcHAuKT8odmltZW9cXC5jb218eW91dHUoYmVcXC5jb218XFwuYmV8YmVcXC5nb29nbGVhcGlzXFwuY29tfGJlXFwtbm9jb29raWVcXC5jb20pfHZ6YWFyXFwuY29tKVxcLyh2aWRlb1xcL3x2aWRlb3NcXC98ZW1iZWRcXC98Y2hhbm5lbHNcXC8uK1xcL3xncm91cHNcXC8uK1xcL3x3YXRjaFxcP3Y9fHZcXC8pPyhbQS1aYS16MC05Ll8lLV0qKShcXCZcXFMrKT8vKTtcclxuXHJcblx0XHRcdGlmIChpZFszXS5pbmRleE9mKCd5b3V0dScpID4gLTEpIHtcclxuXHRcdFx0XHR0eXBlID0gJ3lvdXR1YmUnO1xyXG5cdFx0XHR9IGVsc2UgaWYgKGlkWzNdLmluZGV4T2YoJ3ZpbWVvJykgPiAtMSkge1xyXG5cdFx0XHRcdHR5cGUgPSAndmltZW8nO1xyXG5cdFx0XHR9IGVsc2UgaWYgKGlkWzNdLmluZGV4T2YoJ3Z6YWFyJykgPiAtMSkge1xyXG5cdFx0XHRcdHR5cGUgPSAndnphYXInO1xyXG5cdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdHRocm93IG5ldyBFcnJvcignVmlkZW8gVVJMIG5vdCBzdXBwb3J0ZWQuJyk7XHJcblx0XHRcdH1cclxuXHRcdFx0aWQgPSBpZFs2XTtcclxuXHRcdH0gZWxzZSB7XHJcblx0XHRcdHRocm93IG5ldyBFcnJvcignTWlzc2luZyB2aWRlbyBVUkwuJyk7XHJcblx0XHR9XHJcblxyXG5cdFx0dGhpcy5fdmlkZW9zW3VybF0gPSB7XHJcblx0XHRcdHR5cGU6IHR5cGUsXHJcblx0XHRcdGlkOiBpZCxcclxuXHRcdFx0d2lkdGg6IHdpZHRoLFxyXG5cdFx0XHRoZWlnaHQ6IGhlaWdodFxyXG5cdFx0fTtcclxuXHJcblx0XHRpdGVtLmF0dHIoJ2RhdGEtdmlkZW8nLCB1cmwpO1xyXG5cclxuXHRcdHRoaXMudGh1bWJuYWlsKHRhcmdldCwgdGhpcy5fdmlkZW9zW3VybF0pO1xyXG5cdH07XHJcblxyXG5cdC8qKlxyXG5cdCAqIENyZWF0ZXMgdmlkZW8gdGh1bWJuYWlsLlxyXG5cdCAqIEBwcm90ZWN0ZWRcclxuXHQgKiBAcGFyYW0ge2pRdWVyeX0gdGFyZ2V0IC0gVGhlIHRhcmdldCBjb250YWluaW5nIHRoZSB2aWRlbyBkYXRhLlxyXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSBpbmZvIC0gVGhlIHZpZGVvIGluZm8gb2JqZWN0LlxyXG5cdCAqIEBzZWUgYGZldGNoYFxyXG5cdCAqL1xyXG5cdFZpZGVvLnByb3RvdHlwZS50aHVtYm5haWwgPSBmdW5jdGlvbih0YXJnZXQsIHZpZGVvKSB7XHJcblx0XHR2YXIgdG5MaW5rLFxyXG5cdFx0XHRpY29uLFxyXG5cdFx0XHRwYXRoLFxyXG5cdFx0XHRkaW1lbnNpb25zID0gdmlkZW8ud2lkdGggJiYgdmlkZW8uaGVpZ2h0ID8gJ3dpZHRoOicgKyB2aWRlby53aWR0aCArICdweDtoZWlnaHQ6JyArIHZpZGVvLmhlaWdodCArICdweDsnIDogJycsXHJcblx0XHRcdGN1c3RvbVRuID0gdGFyZ2V0LmZpbmQoJ2ltZycpLFxyXG5cdFx0XHRzcmNUeXBlID0gJ3NyYycsXHJcblx0XHRcdGxhenlDbGFzcyA9ICcnLFxyXG5cdFx0XHRzZXR0aW5ncyA9IHRoaXMuX2NvcmUuc2V0dGluZ3MsXHJcblx0XHRcdGNyZWF0ZSA9IGZ1bmN0aW9uKHBhdGgpIHtcclxuXHRcdFx0XHRpY29uID0gJzxkaXYgY2xhc3M9XCJvd2wtdmlkZW8tcGxheS1pY29uXCI+PC9kaXY+JztcclxuXHJcblx0XHRcdFx0aWYgKHNldHRpbmdzLmxhenlMb2FkKSB7XHJcblx0XHRcdFx0XHR0bkxpbmsgPSAkKCc8ZGl2Lz4nLHtcclxuXHRcdFx0XHRcdFx0XCJjbGFzc1wiOiAnb3dsLXZpZGVvLXRuICcgKyBsYXp5Q2xhc3MsXHJcblx0XHRcdFx0XHRcdFwic3JjVHlwZVwiOiBwYXRoXHJcblx0XHRcdFx0XHR9KTtcclxuXHRcdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdFx0dG5MaW5rID0gJCggJzxkaXYvPicsIHtcclxuXHRcdFx0XHRcdFx0XCJjbGFzc1wiOiBcIm93bC12aWRlby10blwiLFxyXG5cdFx0XHRcdFx0XHRcInN0eWxlXCI6ICdvcGFjaXR5OjE7YmFja2dyb3VuZC1pbWFnZTp1cmwoJyArIHBhdGggKyAnKSdcclxuXHRcdFx0XHRcdH0pO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0XHR0YXJnZXQuYWZ0ZXIodG5MaW5rKTtcclxuXHRcdFx0XHR0YXJnZXQuYWZ0ZXIoaWNvbik7XHJcblx0XHRcdH07XHJcblxyXG5cdFx0Ly8gd3JhcCB2aWRlbyBjb250ZW50IGludG8gb3dsLXZpZGVvLXdyYXBwZXIgZGl2XHJcblx0XHR0YXJnZXQud3JhcCggJCggJzxkaXYvPicsIHtcclxuXHRcdFx0XCJjbGFzc1wiOiBcIm93bC12aWRlby13cmFwcGVyXCIsXHJcblx0XHRcdFwic3R5bGVcIjogZGltZW5zaW9uc1xyXG5cdFx0fSkpO1xyXG5cclxuXHRcdGlmICh0aGlzLl9jb3JlLnNldHRpbmdzLmxhenlMb2FkKSB7XHJcblx0XHRcdHNyY1R5cGUgPSAnZGF0YS1zcmMnO1xyXG5cdFx0XHRsYXp5Q2xhc3MgPSAnb3dsLWxhenknO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8vIGN1c3RvbSB0aHVtYm5haWxcclxuXHRcdGlmIChjdXN0b21Ubi5sZW5ndGgpIHtcclxuXHRcdFx0Y3JlYXRlKGN1c3RvbVRuLmF0dHIoc3JjVHlwZSkpO1xyXG5cdFx0XHRjdXN0b21Ubi5yZW1vdmUoKTtcclxuXHRcdFx0cmV0dXJuIGZhbHNlO1xyXG5cdFx0fVxyXG5cclxuXHRcdGlmICh2aWRlby50eXBlID09PSAneW91dHViZScpIHtcclxuXHRcdFx0cGF0aCA9IFwiLy9pbWcueW91dHViZS5jb20vdmkvXCIgKyB2aWRlby5pZCArIFwiL2hxZGVmYXVsdC5qcGdcIjtcclxuXHRcdFx0Y3JlYXRlKHBhdGgpO1xyXG5cdFx0fSBlbHNlIGlmICh2aWRlby50eXBlID09PSAndmltZW8nKSB7XHJcblx0XHRcdCQuYWpheCh7XHJcblx0XHRcdFx0dHlwZTogJ0dFVCcsXHJcblx0XHRcdFx0dXJsOiAnLy92aW1lby5jb20vYXBpL3YyL3ZpZGVvLycgKyB2aWRlby5pZCArICcuanNvbicsXHJcblx0XHRcdFx0anNvbnA6ICdjYWxsYmFjaycsXHJcblx0XHRcdFx0ZGF0YVR5cGU6ICdqc29ucCcsXHJcblx0XHRcdFx0c3VjY2VzczogZnVuY3Rpb24oZGF0YSkge1xyXG5cdFx0XHRcdFx0cGF0aCA9IGRhdGFbMF0udGh1bWJuYWlsX2xhcmdlO1xyXG5cdFx0XHRcdFx0Y3JlYXRlKHBhdGgpO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fSk7XHJcblx0XHR9IGVsc2UgaWYgKHZpZGVvLnR5cGUgPT09ICd2emFhcicpIHtcclxuXHRcdFx0JC5hamF4KHtcclxuXHRcdFx0XHR0eXBlOiAnR0VUJyxcclxuXHRcdFx0XHR1cmw6ICcvL3Z6YWFyLmNvbS9hcGkvdmlkZW9zLycgKyB2aWRlby5pZCArICcuanNvbicsXHJcblx0XHRcdFx0anNvbnA6ICdjYWxsYmFjaycsXHJcblx0XHRcdFx0ZGF0YVR5cGU6ICdqc29ucCcsXHJcblx0XHRcdFx0c3VjY2VzczogZnVuY3Rpb24oZGF0YSkge1xyXG5cdFx0XHRcdFx0cGF0aCA9IGRhdGEuZnJhbWVncmFiX3VybDtcclxuXHRcdFx0XHRcdGNyZWF0ZShwYXRoKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH0pO1xyXG5cdFx0fVxyXG5cdH07XHJcblxyXG5cdC8qKlxyXG5cdCAqIFN0b3BzIHRoZSBjdXJyZW50IHZpZGVvLlxyXG5cdCAqIEBwdWJsaWNcclxuXHQgKi9cclxuXHRWaWRlby5wcm90b3R5cGUuc3RvcCA9IGZ1bmN0aW9uKCkge1xyXG5cdFx0dGhpcy5fY29yZS50cmlnZ2VyKCdzdG9wJywgbnVsbCwgJ3ZpZGVvJyk7XHJcblx0XHR0aGlzLl9wbGF5aW5nLmZpbmQoJy5vd2wtdmlkZW8tZnJhbWUnKS5yZW1vdmUoKTtcclxuXHRcdHRoaXMuX3BsYXlpbmcucmVtb3ZlQ2xhc3MoJ293bC12aWRlby1wbGF5aW5nJyk7XHJcblx0XHR0aGlzLl9wbGF5aW5nID0gbnVsbDtcclxuXHRcdHRoaXMuX2NvcmUubGVhdmUoJ3BsYXlpbmcnKTtcclxuXHRcdHRoaXMuX2NvcmUudHJpZ2dlcignc3RvcHBlZCcsIG51bGwsICd2aWRlbycpO1xyXG5cdH07XHJcblxyXG5cdC8qKlxyXG5cdCAqIFN0YXJ0cyB0aGUgY3VycmVudCB2aWRlby5cclxuXHQgKiBAcHVibGljXHJcblx0ICogQHBhcmFtIHtFdmVudH0gZXZlbnQgLSBUaGUgZXZlbnQgYXJndW1lbnRzLlxyXG5cdCAqL1xyXG5cdFZpZGVvLnByb3RvdHlwZS5wbGF5ID0gZnVuY3Rpb24oZXZlbnQpIHtcclxuXHRcdHZhciB0YXJnZXQgPSAkKGV2ZW50LnRhcmdldCksXHJcblx0XHRcdGl0ZW0gPSB0YXJnZXQuY2xvc2VzdCgnLicgKyB0aGlzLl9jb3JlLnNldHRpbmdzLml0ZW1DbGFzcyksXHJcblx0XHRcdHZpZGVvID0gdGhpcy5fdmlkZW9zW2l0ZW0uYXR0cignZGF0YS12aWRlbycpXSxcclxuXHRcdFx0d2lkdGggPSB2aWRlby53aWR0aCB8fCAnMTAwJScsXHJcblx0XHRcdGhlaWdodCA9IHZpZGVvLmhlaWdodCB8fCB0aGlzLl9jb3JlLiRzdGFnZS5oZWlnaHQoKSxcclxuXHRcdFx0aHRtbCxcclxuXHRcdFx0aWZyYW1lO1xyXG5cclxuXHRcdGlmICh0aGlzLl9wbGF5aW5nKSB7XHJcblx0XHRcdHJldHVybjtcclxuXHRcdH1cclxuXHJcblx0XHR0aGlzLl9jb3JlLmVudGVyKCdwbGF5aW5nJyk7XHJcblx0XHR0aGlzLl9jb3JlLnRyaWdnZXIoJ3BsYXknLCBudWxsLCAndmlkZW8nKTtcclxuXHJcblx0XHRpdGVtID0gdGhpcy5fY29yZS5pdGVtcyh0aGlzLl9jb3JlLnJlbGF0aXZlKGl0ZW0uaW5kZXgoKSkpO1xyXG5cclxuXHRcdHRoaXMuX2NvcmUucmVzZXQoaXRlbS5pbmRleCgpKTtcclxuXHJcblx0XHRodG1sID0gJCggJzxpZnJhbWUgZnJhbWVib3JkZXI9XCIwXCIgYWxsb3dmdWxsc2NyZWVuIG1vemFsbG93ZnVsbHNjcmVlbiB3ZWJraXRBbGxvd0Z1bGxTY3JlZW4gPjwvaWZyYW1lPicgKTtcclxuXHRcdGh0bWwuYXR0ciggJ2hlaWdodCcsIGhlaWdodCApO1xyXG5cdFx0aHRtbC5hdHRyKCAnd2lkdGgnLCB3aWR0aCApO1xyXG5cdFx0aWYgKHZpZGVvLnR5cGUgPT09ICd5b3V0dWJlJykge1xyXG5cdFx0XHRodG1sLmF0dHIoICdzcmMnLCAnLy93d3cueW91dHViZS5jb20vZW1iZWQvJyArIHZpZGVvLmlkICsgJz9hdXRvcGxheT0xJnJlbD0wJnY9JyArIHZpZGVvLmlkICk7XHJcblx0XHR9IGVsc2UgaWYgKHZpZGVvLnR5cGUgPT09ICd2aW1lbycpIHtcclxuXHRcdFx0aHRtbC5hdHRyKCAnc3JjJywgJy8vcGxheWVyLnZpbWVvLmNvbS92aWRlby8nICsgdmlkZW8uaWQgKyAnP2F1dG9wbGF5PTEnICk7XHJcblx0XHR9IGVsc2UgaWYgKHZpZGVvLnR5cGUgPT09ICd2emFhcicpIHtcclxuXHRcdFx0aHRtbC5hdHRyKCAnc3JjJywgJy8vdmlldy52emFhci5jb20vJyArIHZpZGVvLmlkICsgJy9wbGF5ZXI/YXV0b3BsYXk9dHJ1ZScgKTtcclxuXHRcdH1cclxuXHJcblx0XHRpZnJhbWUgPSAkKGh0bWwpLndyYXAoICc8ZGl2IGNsYXNzPVwib3dsLXZpZGVvLWZyYW1lXCIgLz4nICkuaW5zZXJ0QWZ0ZXIoaXRlbS5maW5kKCcub3dsLXZpZGVvJykpO1xyXG5cclxuXHRcdHRoaXMuX3BsYXlpbmcgPSBpdGVtLmFkZENsYXNzKCdvd2wtdmlkZW8tcGxheWluZycpO1xyXG5cdH07XHJcblxyXG5cdC8qKlxyXG5cdCAqIENoZWNrcyB3aGV0aGVyIGFuIHZpZGVvIGlzIGN1cnJlbnRseSBpbiBmdWxsIHNjcmVlbiBtb2RlIG9yIG5vdC5cclxuXHQgKiBAdG9kbyBCYWQgc3R5bGUgYmVjYXVzZSBsb29rcyBsaWtlIGEgcmVhZG9ubHkgbWV0aG9kIGJ1dCBjaGFuZ2VzIG1lbWJlcnMuXHJcblx0ICogQHByb3RlY3RlZFxyXG5cdCAqIEByZXR1cm5zIHtCb29sZWFufVxyXG5cdCAqL1xyXG5cdFZpZGVvLnByb3RvdHlwZS5pc0luRnVsbFNjcmVlbiA9IGZ1bmN0aW9uKCkge1xyXG5cdFx0dmFyIGVsZW1lbnQgPSBkb2N1bWVudC5mdWxsc2NyZWVuRWxlbWVudCB8fCBkb2N1bWVudC5tb3pGdWxsU2NyZWVuRWxlbWVudCB8fFxyXG5cdFx0XHRcdGRvY3VtZW50LndlYmtpdEZ1bGxzY3JlZW5FbGVtZW50O1xyXG5cclxuXHRcdHJldHVybiBlbGVtZW50ICYmICQoZWxlbWVudCkucGFyZW50KCkuaGFzQ2xhc3MoJ293bC12aWRlby1mcmFtZScpO1xyXG5cdH07XHJcblxyXG5cdC8qKlxyXG5cdCAqIERlc3Ryb3lzIHRoZSBwbHVnaW4uXHJcblx0ICovXHJcblx0VmlkZW8ucHJvdG90eXBlLmRlc3Ryb3kgPSBmdW5jdGlvbigpIHtcclxuXHRcdHZhciBoYW5kbGVyLCBwcm9wZXJ0eTtcclxuXHJcblx0XHR0aGlzLl9jb3JlLiRlbGVtZW50Lm9mZignY2xpY2sub3dsLnZpZGVvJyk7XHJcblxyXG5cdFx0Zm9yIChoYW5kbGVyIGluIHRoaXMuX2hhbmRsZXJzKSB7XHJcblx0XHRcdHRoaXMuX2NvcmUuJGVsZW1lbnQub2ZmKGhhbmRsZXIsIHRoaXMuX2hhbmRsZXJzW2hhbmRsZXJdKTtcclxuXHRcdH1cclxuXHRcdGZvciAocHJvcGVydHkgaW4gT2JqZWN0LmdldE93blByb3BlcnR5TmFtZXModGhpcykpIHtcclxuXHRcdFx0dHlwZW9mIHRoaXNbcHJvcGVydHldICE9ICdmdW5jdGlvbicgJiYgKHRoaXNbcHJvcGVydHldID0gbnVsbCk7XHJcblx0XHR9XHJcblx0fTtcclxuXHJcblx0JC5mbi5vd2xDYXJvdXNlbC5Db25zdHJ1Y3Rvci5QbHVnaW5zLlZpZGVvID0gVmlkZW87XHJcblxyXG59KSh3aW5kb3cuWmVwdG8gfHwgd2luZG93LmpRdWVyeSwgd2luZG93LCBkb2N1bWVudCk7XHJcblxyXG4vKipcclxuICogQW5pbWF0ZSBQbHVnaW5cclxuICogQHZlcnNpb24gMi4zLjRcclxuICogQGF1dGhvciBCYXJ0b3N6IFdvamNpZWNob3dza2lcclxuICogQGF1dGhvciBEYXZpZCBEZXV0c2NoXHJcbiAqIEBsaWNlbnNlIFRoZSBNSVQgTGljZW5zZSAoTUlUKVxyXG4gKi9cclxuOyhmdW5jdGlvbigkLCB3aW5kb3csIGRvY3VtZW50LCB1bmRlZmluZWQpIHtcclxuXHJcblx0LyoqXHJcblx0ICogQ3JlYXRlcyB0aGUgYW5pbWF0ZSBwbHVnaW4uXHJcblx0ICogQGNsYXNzIFRoZSBOYXZpZ2F0aW9uIFBsdWdpblxyXG5cdCAqIEBwYXJhbSB7T3dsfSBzY29wZSAtIFRoZSBPd2wgQ2Fyb3VzZWxcclxuXHQgKi9cclxuXHR2YXIgQW5pbWF0ZSA9IGZ1bmN0aW9uKHNjb3BlKSB7XHJcblx0XHR0aGlzLmNvcmUgPSBzY29wZTtcclxuXHRcdHRoaXMuY29yZS5vcHRpb25zID0gJC5leHRlbmQoe30sIEFuaW1hdGUuRGVmYXVsdHMsIHRoaXMuY29yZS5vcHRpb25zKTtcclxuXHRcdHRoaXMuc3dhcHBpbmcgPSB0cnVlO1xyXG5cdFx0dGhpcy5wcmV2aW91cyA9IHVuZGVmaW5lZDtcclxuXHRcdHRoaXMubmV4dCA9IHVuZGVmaW5lZDtcclxuXHJcblx0XHR0aGlzLmhhbmRsZXJzID0ge1xyXG5cdFx0XHQnY2hhbmdlLm93bC5jYXJvdXNlbCc6ICQucHJveHkoZnVuY3Rpb24oZSkge1xyXG5cdFx0XHRcdGlmIChlLm5hbWVzcGFjZSAmJiBlLnByb3BlcnR5Lm5hbWUgPT0gJ3Bvc2l0aW9uJykge1xyXG5cdFx0XHRcdFx0dGhpcy5wcmV2aW91cyA9IHRoaXMuY29yZS5jdXJyZW50KCk7XHJcblx0XHRcdFx0XHR0aGlzLm5leHQgPSBlLnByb3BlcnR5LnZhbHVlO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fSwgdGhpcyksXHJcblx0XHRcdCdkcmFnLm93bC5jYXJvdXNlbCBkcmFnZ2VkLm93bC5jYXJvdXNlbCB0cmFuc2xhdGVkLm93bC5jYXJvdXNlbCc6ICQucHJveHkoZnVuY3Rpb24oZSkge1xyXG5cdFx0XHRcdGlmIChlLm5hbWVzcGFjZSkge1xyXG5cdFx0XHRcdFx0dGhpcy5zd2FwcGluZyA9IGUudHlwZSA9PSAndHJhbnNsYXRlZCc7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9LCB0aGlzKSxcclxuXHRcdFx0J3RyYW5zbGF0ZS5vd2wuY2Fyb3VzZWwnOiAkLnByb3h5KGZ1bmN0aW9uKGUpIHtcclxuXHRcdFx0XHRpZiAoZS5uYW1lc3BhY2UgJiYgdGhpcy5zd2FwcGluZyAmJiAodGhpcy5jb3JlLm9wdGlvbnMuYW5pbWF0ZU91dCB8fCB0aGlzLmNvcmUub3B0aW9ucy5hbmltYXRlSW4pKSB7XHJcblx0XHRcdFx0XHR0aGlzLnN3YXAoKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH0sIHRoaXMpXHJcblx0XHR9O1xyXG5cclxuXHRcdHRoaXMuY29yZS4kZWxlbWVudC5vbih0aGlzLmhhbmRsZXJzKTtcclxuXHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiBEZWZhdWx0IG9wdGlvbnMuXHJcblx0ICogQHB1YmxpY1xyXG5cdCAqL1xyXG5cdEFuaW1hdGUuRGVmYXVsdHMgPSB7XHJcblx0XHRhbmltYXRlT3V0OiBmYWxzZSxcclxuXHRcdGFuaW1hdGVJbjogZmFsc2VcclxuXHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiBUb2dnbGVzIHRoZSBhbmltYXRpb24gY2xhc3NlcyB3aGVuZXZlciBhbiB0cmFuc2xhdGlvbnMgc3RhcnRzLlxyXG5cdCAqIEBwcm90ZWN0ZWRcclxuXHQgKiBAcmV0dXJucyB7Qm9vbGVhbnx1bmRlZmluZWR9XHJcblx0ICovXHJcblx0QW5pbWF0ZS5wcm90b3R5cGUuc3dhcCA9IGZ1bmN0aW9uKCkge1xyXG5cclxuXHRcdGlmICh0aGlzLmNvcmUuc2V0dGluZ3MuaXRlbXMgIT09IDEpIHtcclxuXHRcdFx0cmV0dXJuO1xyXG5cdFx0fVxyXG5cclxuXHRcdGlmICghJC5zdXBwb3J0LmFuaW1hdGlvbiB8fCAhJC5zdXBwb3J0LnRyYW5zaXRpb24pIHtcclxuXHRcdFx0cmV0dXJuO1xyXG5cdFx0fVxyXG5cclxuXHRcdHRoaXMuY29yZS5zcGVlZCgwKTtcclxuXHJcblx0XHR2YXIgbGVmdCxcclxuXHRcdFx0Y2xlYXIgPSAkLnByb3h5KHRoaXMuY2xlYXIsIHRoaXMpLFxyXG5cdFx0XHRwcmV2aW91cyA9IHRoaXMuY29yZS4kc3RhZ2UuY2hpbGRyZW4oKS5lcSh0aGlzLnByZXZpb3VzKSxcclxuXHRcdFx0bmV4dCA9IHRoaXMuY29yZS4kc3RhZ2UuY2hpbGRyZW4oKS5lcSh0aGlzLm5leHQpLFxyXG5cdFx0XHRpbmNvbWluZyA9IHRoaXMuY29yZS5zZXR0aW5ncy5hbmltYXRlSW4sXHJcblx0XHRcdG91dGdvaW5nID0gdGhpcy5jb3JlLnNldHRpbmdzLmFuaW1hdGVPdXQ7XHJcblxyXG5cdFx0aWYgKHRoaXMuY29yZS5jdXJyZW50KCkgPT09IHRoaXMucHJldmlvdXMpIHtcclxuXHRcdFx0cmV0dXJuO1xyXG5cdFx0fVxyXG5cclxuXHRcdGlmIChvdXRnb2luZykge1xyXG5cdFx0XHRsZWZ0ID0gdGhpcy5jb3JlLmNvb3JkaW5hdGVzKHRoaXMucHJldmlvdXMpIC0gdGhpcy5jb3JlLmNvb3JkaW5hdGVzKHRoaXMubmV4dCk7XHJcblx0XHRcdHByZXZpb3VzLm9uZSgkLnN1cHBvcnQuYW5pbWF0aW9uLmVuZCwgY2xlYXIpXHJcblx0XHRcdFx0LmNzcyggeyAnbGVmdCc6IGxlZnQgKyAncHgnIH0gKVxyXG5cdFx0XHRcdC5hZGRDbGFzcygnYW5pbWF0ZWQgb3dsLWFuaW1hdGVkLW91dCcpXHJcblx0XHRcdFx0LmFkZENsYXNzKG91dGdvaW5nKTtcclxuXHRcdH1cclxuXHJcblx0XHRpZiAoaW5jb21pbmcpIHtcclxuXHRcdFx0bmV4dC5vbmUoJC5zdXBwb3J0LmFuaW1hdGlvbi5lbmQsIGNsZWFyKVxyXG5cdFx0XHRcdC5hZGRDbGFzcygnYW5pbWF0ZWQgb3dsLWFuaW1hdGVkLWluJylcclxuXHRcdFx0XHQuYWRkQ2xhc3MoaW5jb21pbmcpO1xyXG5cdFx0fVxyXG5cdH07XHJcblxyXG5cdEFuaW1hdGUucHJvdG90eXBlLmNsZWFyID0gZnVuY3Rpb24oZSkge1xyXG5cdFx0JChlLnRhcmdldCkuY3NzKCB7ICdsZWZ0JzogJycgfSApXHJcblx0XHRcdC5yZW1vdmVDbGFzcygnYW5pbWF0ZWQgb3dsLWFuaW1hdGVkLW91dCBvd2wtYW5pbWF0ZWQtaW4nKVxyXG5cdFx0XHQucmVtb3ZlQ2xhc3ModGhpcy5jb3JlLnNldHRpbmdzLmFuaW1hdGVJbilcclxuXHRcdFx0LnJlbW92ZUNsYXNzKHRoaXMuY29yZS5zZXR0aW5ncy5hbmltYXRlT3V0KTtcclxuXHRcdHRoaXMuY29yZS5vblRyYW5zaXRpb25FbmQoKTtcclxuXHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiBEZXN0cm95cyB0aGUgcGx1Z2luLlxyXG5cdCAqIEBwdWJsaWNcclxuXHQgKi9cclxuXHRBbmltYXRlLnByb3RvdHlwZS5kZXN0cm95ID0gZnVuY3Rpb24oKSB7XHJcblx0XHR2YXIgaGFuZGxlciwgcHJvcGVydHk7XHJcblxyXG5cdFx0Zm9yIChoYW5kbGVyIGluIHRoaXMuaGFuZGxlcnMpIHtcclxuXHRcdFx0dGhpcy5jb3JlLiRlbGVtZW50Lm9mZihoYW5kbGVyLCB0aGlzLmhhbmRsZXJzW2hhbmRsZXJdKTtcclxuXHRcdH1cclxuXHRcdGZvciAocHJvcGVydHkgaW4gT2JqZWN0LmdldE93blByb3BlcnR5TmFtZXModGhpcykpIHtcclxuXHRcdFx0dHlwZW9mIHRoaXNbcHJvcGVydHldICE9ICdmdW5jdGlvbicgJiYgKHRoaXNbcHJvcGVydHldID0gbnVsbCk7XHJcblx0XHR9XHJcblx0fTtcclxuXHJcblx0JC5mbi5vd2xDYXJvdXNlbC5Db25zdHJ1Y3Rvci5QbHVnaW5zLkFuaW1hdGUgPSBBbmltYXRlO1xyXG5cclxufSkod2luZG93LlplcHRvIHx8IHdpbmRvdy5qUXVlcnksIHdpbmRvdywgZG9jdW1lbnQpO1xyXG5cclxuLyoqXHJcbiAqIEF1dG9wbGF5IFBsdWdpblxyXG4gKiBAdmVyc2lvbiAyLjMuNFxyXG4gKiBAYXV0aG9yIEJhcnRvc3ogV29qY2llY2hvd3NraVxyXG4gKiBAYXV0aG9yIEFydHVzIEtvbGFub3dza2lcclxuICogQGF1dGhvciBEYXZpZCBEZXV0c2NoXHJcbiAqIEBhdXRob3IgVG9tIERlIENhbHV3w6lcclxuICogQGxpY2Vuc2UgVGhlIE1JVCBMaWNlbnNlIChNSVQpXHJcbiAqL1xyXG47KGZ1bmN0aW9uKCQsIHdpbmRvdywgZG9jdW1lbnQsIHVuZGVmaW5lZCkge1xyXG5cclxuXHQvKipcclxuXHQgKiBDcmVhdGVzIHRoZSBhdXRvcGxheSBwbHVnaW4uXHJcblx0ICogQGNsYXNzIFRoZSBBdXRvcGxheSBQbHVnaW5cclxuXHQgKiBAcGFyYW0ge093bH0gc2NvcGUgLSBUaGUgT3dsIENhcm91c2VsXHJcblx0ICovXHJcblx0dmFyIEF1dG9wbGF5ID0gZnVuY3Rpb24oY2Fyb3VzZWwpIHtcclxuXHRcdC8qKlxyXG5cdFx0ICogUmVmZXJlbmNlIHRvIHRoZSBjb3JlLlxyXG5cdFx0ICogQHByb3RlY3RlZFxyXG5cdFx0ICogQHR5cGUge093bH1cclxuXHRcdCAqL1xyXG5cdFx0dGhpcy5fY29yZSA9IGNhcm91c2VsO1xyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogVGhlIGF1dG9wbGF5IHRpbWVvdXQgaWQuXHJcblx0XHQgKiBAdHlwZSB7TnVtYmVyfVxyXG5cdFx0ICovXHJcblx0XHR0aGlzLl9jYWxsID0gbnVsbDtcclxuXHJcblx0XHQvKipcclxuXHRcdCAqIERlcGVuZGluZyBvbiB0aGUgc3RhdGUgb2YgdGhlIHBsdWdpbiwgdGhpcyB2YXJpYWJsZSBjb250YWlucyBlaXRoZXJcclxuXHRcdCAqIHRoZSBzdGFydCB0aW1lIG9mIHRoZSB0aW1lciBvciB0aGUgY3VycmVudCB0aW1lciB2YWx1ZSBpZiBpdCdzXHJcblx0XHQgKiBwYXVzZWQuIFNpbmNlIHdlIHN0YXJ0IGluIGEgcGF1c2VkIHN0YXRlIHdlIGluaXRpYWxpemUgdGhlIHRpbWVyXHJcblx0XHQgKiB2YWx1ZS5cclxuXHRcdCAqIEB0eXBlIHtOdW1iZXJ9XHJcblx0XHQgKi9cclxuXHRcdHRoaXMuX3RpbWUgPSAwO1xyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogU3RvcmVzIHRoZSB0aW1lb3V0IGN1cnJlbnRseSB1c2VkLlxyXG5cdFx0ICogQHR5cGUge051bWJlcn1cclxuXHRcdCAqL1xyXG5cdFx0dGhpcy5fdGltZW91dCA9IDA7XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBJbmRpY2F0ZXMgd2hlbmV2ZXIgdGhlIGF1dG9wbGF5IGlzIHBhdXNlZC5cclxuXHRcdCAqIEB0eXBlIHtCb29sZWFufVxyXG5cdFx0ICovXHJcblx0XHR0aGlzLl9wYXVzZWQgPSB0cnVlO1xyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogQWxsIGV2ZW50IGhhbmRsZXJzLlxyXG5cdFx0ICogQHByb3RlY3RlZFxyXG5cdFx0ICogQHR5cGUge09iamVjdH1cclxuXHRcdCAqL1xyXG5cdFx0dGhpcy5faGFuZGxlcnMgPSB7XHJcblx0XHRcdCdjaGFuZ2VkLm93bC5jYXJvdXNlbCc6ICQucHJveHkoZnVuY3Rpb24oZSkge1xyXG5cdFx0XHRcdGlmIChlLm5hbWVzcGFjZSAmJiBlLnByb3BlcnR5Lm5hbWUgPT09ICdzZXR0aW5ncycpIHtcclxuXHRcdFx0XHRcdGlmICh0aGlzLl9jb3JlLnNldHRpbmdzLmF1dG9wbGF5KSB7XHJcblx0XHRcdFx0XHRcdHRoaXMucGxheSgpO1xyXG5cdFx0XHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRcdFx0dGhpcy5zdG9wKCk7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0fSBlbHNlIGlmIChlLm5hbWVzcGFjZSAmJiBlLnByb3BlcnR5Lm5hbWUgPT09ICdwb3NpdGlvbicgJiYgdGhpcy5fcGF1c2VkKSB7XHJcblx0XHRcdFx0XHQvLyBSZXNldCB0aGUgdGltZXIuIFRoaXMgY29kZSBpcyB0cmlnZ2VyZWQgd2hlbiB0aGUgcG9zaXRpb25cclxuXHRcdFx0XHRcdC8vIG9mIHRoZSBjYXJvdXNlbCB3YXMgY2hhbmdlZCB0aHJvdWdoIHVzZXIgaW50ZXJhY3Rpb24uXHJcblx0XHRcdFx0XHR0aGlzLl90aW1lID0gMDtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH0sIHRoaXMpLFxyXG5cdFx0XHQnaW5pdGlhbGl6ZWQub3dsLmNhcm91c2VsJzogJC5wcm94eShmdW5jdGlvbihlKSB7XHJcblx0XHRcdFx0aWYgKGUubmFtZXNwYWNlICYmIHRoaXMuX2NvcmUuc2V0dGluZ3MuYXV0b3BsYXkpIHtcclxuXHRcdFx0XHRcdHRoaXMucGxheSgpO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fSwgdGhpcyksXHJcblx0XHRcdCdwbGF5Lm93bC5hdXRvcGxheSc6ICQucHJveHkoZnVuY3Rpb24oZSwgdCwgcykge1xyXG5cdFx0XHRcdGlmIChlLm5hbWVzcGFjZSkge1xyXG5cdFx0XHRcdFx0dGhpcy5wbGF5KHQsIHMpO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fSwgdGhpcyksXHJcblx0XHRcdCdzdG9wLm93bC5hdXRvcGxheSc6ICQucHJveHkoZnVuY3Rpb24oZSkge1xyXG5cdFx0XHRcdGlmIChlLm5hbWVzcGFjZSkge1xyXG5cdFx0XHRcdFx0dGhpcy5zdG9wKCk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9LCB0aGlzKSxcclxuXHRcdFx0J21vdXNlb3Zlci5vd2wuYXV0b3BsYXknOiAkLnByb3h5KGZ1bmN0aW9uKCkge1xyXG5cdFx0XHRcdGlmICh0aGlzLl9jb3JlLnNldHRpbmdzLmF1dG9wbGF5SG92ZXJQYXVzZSAmJiB0aGlzLl9jb3JlLmlzKCdyb3RhdGluZycpKSB7XHJcblx0XHRcdFx0XHR0aGlzLnBhdXNlKCk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9LCB0aGlzKSxcclxuXHRcdFx0J21vdXNlbGVhdmUub3dsLmF1dG9wbGF5JzogJC5wcm94eShmdW5jdGlvbigpIHtcclxuXHRcdFx0XHRpZiAodGhpcy5fY29yZS5zZXR0aW5ncy5hdXRvcGxheUhvdmVyUGF1c2UgJiYgdGhpcy5fY29yZS5pcygncm90YXRpbmcnKSkge1xyXG5cdFx0XHRcdFx0dGhpcy5wbGF5KCk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9LCB0aGlzKSxcclxuXHRcdFx0J3RvdWNoc3RhcnQub3dsLmNvcmUnOiAkLnByb3h5KGZ1bmN0aW9uKCkge1xyXG5cdFx0XHRcdGlmICh0aGlzLl9jb3JlLnNldHRpbmdzLmF1dG9wbGF5SG92ZXJQYXVzZSAmJiB0aGlzLl9jb3JlLmlzKCdyb3RhdGluZycpKSB7XHJcblx0XHRcdFx0XHR0aGlzLnBhdXNlKCk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9LCB0aGlzKSxcclxuXHRcdFx0J3RvdWNoZW5kLm93bC5jb3JlJzogJC5wcm94eShmdW5jdGlvbigpIHtcclxuXHRcdFx0XHRpZiAodGhpcy5fY29yZS5zZXR0aW5ncy5hdXRvcGxheUhvdmVyUGF1c2UpIHtcclxuXHRcdFx0XHRcdHRoaXMucGxheSgpO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fSwgdGhpcylcclxuXHRcdH07XHJcblxyXG5cdFx0Ly8gcmVnaXN0ZXIgZXZlbnQgaGFuZGxlcnNcclxuXHRcdHRoaXMuX2NvcmUuJGVsZW1lbnQub24odGhpcy5faGFuZGxlcnMpO1xyXG5cclxuXHRcdC8vIHNldCBkZWZhdWx0IG9wdGlvbnNcclxuXHRcdHRoaXMuX2NvcmUub3B0aW9ucyA9ICQuZXh0ZW5kKHt9LCBBdXRvcGxheS5EZWZhdWx0cywgdGhpcy5fY29yZS5vcHRpb25zKTtcclxuXHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiBEZWZhdWx0IG9wdGlvbnMuXHJcblx0ICogQHB1YmxpY1xyXG5cdCAqL1xyXG5cdEF1dG9wbGF5LkRlZmF1bHRzID0ge1xyXG5cdFx0YXV0b3BsYXk6IGZhbHNlLFxyXG5cdFx0YXV0b3BsYXlUaW1lb3V0OiA1MDAwLFxyXG5cdFx0YXV0b3BsYXlIb3ZlclBhdXNlOiBmYWxzZSxcclxuXHRcdGF1dG9wbGF5U3BlZWQ6IGZhbHNlXHJcblx0fTtcclxuXHJcblx0LyoqXHJcblx0ICogVHJhbnNpdGlvbiB0byB0aGUgbmV4dCBzbGlkZSBhbmQgc2V0IGEgdGltZW91dCBmb3IgdGhlIG5leHQgdHJhbnNpdGlvbi5cclxuXHQgKiBAcHJpdmF0ZVxyXG5cdCAqIEBwYXJhbSB7TnVtYmVyfSBbc3BlZWRdIC0gVGhlIGFuaW1hdGlvbiBzcGVlZCBmb3IgdGhlIGFuaW1hdGlvbnMuXHJcblx0ICovXHJcblx0QXV0b3BsYXkucHJvdG90eXBlLl9uZXh0ID0gZnVuY3Rpb24oc3BlZWQpIHtcclxuXHRcdHRoaXMuX2NhbGwgPSB3aW5kb3cuc2V0VGltZW91dChcclxuXHRcdFx0JC5wcm94eSh0aGlzLl9uZXh0LCB0aGlzLCBzcGVlZCksXHJcblx0XHRcdHRoaXMuX3RpbWVvdXQgKiAoTWF0aC5yb3VuZCh0aGlzLnJlYWQoKSAvIHRoaXMuX3RpbWVvdXQpICsgMSkgLSB0aGlzLnJlYWQoKVxyXG5cdFx0KTtcclxuXHJcblx0XHRpZiAodGhpcy5fY29yZS5pcygnaW50ZXJhY3RpbmcnKSB8fCBkb2N1bWVudC5oaWRkZW4pIHtcclxuXHRcdFx0cmV0dXJuO1xyXG5cdFx0fVxyXG5cdFx0dGhpcy5fY29yZS5uZXh0KHNwZWVkIHx8IHRoaXMuX2NvcmUuc2V0dGluZ3MuYXV0b3BsYXlTcGVlZCk7XHJcblx0fVxyXG5cclxuXHQvKipcclxuXHQgKiBSZWFkcyB0aGUgY3VycmVudCB0aW1lciB2YWx1ZSB3aGVuIHRoZSB0aW1lciBpcyBwbGF5aW5nLlxyXG5cdCAqIEBwdWJsaWNcclxuXHQgKi9cclxuXHRBdXRvcGxheS5wcm90b3R5cGUucmVhZCA9IGZ1bmN0aW9uKCkge1xyXG5cdFx0cmV0dXJuIG5ldyBEYXRlKCkuZ2V0VGltZSgpIC0gdGhpcy5fdGltZTtcclxuXHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiBTdGFydHMgdGhlIGF1dG9wbGF5LlxyXG5cdCAqIEBwdWJsaWNcclxuXHQgKiBAcGFyYW0ge051bWJlcn0gW3RpbWVvdXRdIC0gVGhlIGludGVydmFsIGJlZm9yZSB0aGUgbmV4dCBhbmltYXRpb24gc3RhcnRzLlxyXG5cdCAqIEBwYXJhbSB7TnVtYmVyfSBbc3BlZWRdIC0gVGhlIGFuaW1hdGlvbiBzcGVlZCBmb3IgdGhlIGFuaW1hdGlvbnMuXHJcblx0ICovXHJcblx0QXV0b3BsYXkucHJvdG90eXBlLnBsYXkgPSBmdW5jdGlvbih0aW1lb3V0LCBzcGVlZCkge1xyXG5cdFx0dmFyIGVsYXBzZWQ7XHJcblxyXG5cdFx0aWYgKCF0aGlzLl9jb3JlLmlzKCdyb3RhdGluZycpKSB7XHJcblx0XHRcdHRoaXMuX2NvcmUuZW50ZXIoJ3JvdGF0aW5nJyk7XHJcblx0XHR9XHJcblxyXG5cdFx0dGltZW91dCA9IHRpbWVvdXQgfHwgdGhpcy5fY29yZS5zZXR0aW5ncy5hdXRvcGxheVRpbWVvdXQ7XHJcblxyXG5cdFx0Ly8gQ2FsY3VsYXRlIHRoZSBlbGFwc2VkIHRpbWUgc2luY2UgdGhlIGxhc3QgdHJhbnNpdGlvbi4gSWYgdGhlIGNhcm91c2VsXHJcblx0XHQvLyB3YXNuJ3QgcGxheWluZyB0aGlzIGNhbGN1bGF0aW9uIHdpbGwgeWllbGQgemVyby5cclxuXHRcdGVsYXBzZWQgPSBNYXRoLm1pbih0aGlzLl90aW1lICUgKHRoaXMuX3RpbWVvdXQgfHwgdGltZW91dCksIHRpbWVvdXQpO1xyXG5cclxuXHRcdGlmICh0aGlzLl9wYXVzZWQpIHtcclxuXHRcdFx0Ly8gU3RhcnQgdGhlIGNsb2NrLlxyXG5cdFx0XHR0aGlzLl90aW1lID0gdGhpcy5yZWFkKCk7XHJcblx0XHRcdHRoaXMuX3BhdXNlZCA9IGZhbHNlO1xyXG5cdFx0fSBlbHNlIHtcclxuXHRcdFx0Ly8gQ2xlYXIgdGhlIGFjdGl2ZSB0aW1lb3V0IHRvIGFsbG93IHJlcGxhY2VtZW50LlxyXG5cdFx0XHR3aW5kb3cuY2xlYXJUaW1lb3V0KHRoaXMuX2NhbGwpO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8vIEFkanVzdCB0aGUgb3JpZ2luIG9mIHRoZSB0aW1lciB0byBtYXRjaCB0aGUgbmV3IHRpbWVvdXQgdmFsdWUuXHJcblx0XHR0aGlzLl90aW1lICs9IHRoaXMucmVhZCgpICUgdGltZW91dCAtIGVsYXBzZWQ7XHJcblxyXG5cdFx0dGhpcy5fdGltZW91dCA9IHRpbWVvdXQ7XHJcblx0XHR0aGlzLl9jYWxsID0gd2luZG93LnNldFRpbWVvdXQoJC5wcm94eSh0aGlzLl9uZXh0LCB0aGlzLCBzcGVlZCksIHRpbWVvdXQgLSBlbGFwc2VkKTtcclxuXHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiBTdG9wcyB0aGUgYXV0b3BsYXkuXHJcblx0ICogQHB1YmxpY1xyXG5cdCAqL1xyXG5cdEF1dG9wbGF5LnByb3RvdHlwZS5zdG9wID0gZnVuY3Rpb24oKSB7XHJcblx0XHRpZiAodGhpcy5fY29yZS5pcygncm90YXRpbmcnKSkge1xyXG5cdFx0XHQvLyBSZXNldCB0aGUgY2xvY2suXHJcblx0XHRcdHRoaXMuX3RpbWUgPSAwO1xyXG5cdFx0XHR0aGlzLl9wYXVzZWQgPSB0cnVlO1xyXG5cclxuXHRcdFx0d2luZG93LmNsZWFyVGltZW91dCh0aGlzLl9jYWxsKTtcclxuXHRcdFx0dGhpcy5fY29yZS5sZWF2ZSgncm90YXRpbmcnKTtcclxuXHRcdH1cclxuXHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiBQYXVzZXMgdGhlIGF1dG9wbGF5LlxyXG5cdCAqIEBwdWJsaWNcclxuXHQgKi9cclxuXHRBdXRvcGxheS5wcm90b3R5cGUucGF1c2UgPSBmdW5jdGlvbigpIHtcclxuXHRcdGlmICh0aGlzLl9jb3JlLmlzKCdyb3RhdGluZycpICYmICF0aGlzLl9wYXVzZWQpIHtcclxuXHRcdFx0Ly8gUGF1c2UgdGhlIGNsb2NrLlxyXG5cdFx0XHR0aGlzLl90aW1lID0gdGhpcy5yZWFkKCk7XHJcblx0XHRcdHRoaXMuX3BhdXNlZCA9IHRydWU7XHJcblxyXG5cdFx0XHR3aW5kb3cuY2xlYXJUaW1lb3V0KHRoaXMuX2NhbGwpO1xyXG5cdFx0fVxyXG5cdH07XHJcblxyXG5cdC8qKlxyXG5cdCAqIERlc3Ryb3lzIHRoZSBwbHVnaW4uXHJcblx0ICovXHJcblx0QXV0b3BsYXkucHJvdG90eXBlLmRlc3Ryb3kgPSBmdW5jdGlvbigpIHtcclxuXHRcdHZhciBoYW5kbGVyLCBwcm9wZXJ0eTtcclxuXHJcblx0XHR0aGlzLnN0b3AoKTtcclxuXHJcblx0XHRmb3IgKGhhbmRsZXIgaW4gdGhpcy5faGFuZGxlcnMpIHtcclxuXHRcdFx0dGhpcy5fY29yZS4kZWxlbWVudC5vZmYoaGFuZGxlciwgdGhpcy5faGFuZGxlcnNbaGFuZGxlcl0pO1xyXG5cdFx0fVxyXG5cdFx0Zm9yIChwcm9wZXJ0eSBpbiBPYmplY3QuZ2V0T3duUHJvcGVydHlOYW1lcyh0aGlzKSkge1xyXG5cdFx0XHR0eXBlb2YgdGhpc1twcm9wZXJ0eV0gIT0gJ2Z1bmN0aW9uJyAmJiAodGhpc1twcm9wZXJ0eV0gPSBudWxsKTtcclxuXHRcdH1cclxuXHR9O1xyXG5cclxuXHQkLmZuLm93bENhcm91c2VsLkNvbnN0cnVjdG9yLlBsdWdpbnMuYXV0b3BsYXkgPSBBdXRvcGxheTtcclxuXHJcbn0pKHdpbmRvdy5aZXB0byB8fCB3aW5kb3cualF1ZXJ5LCB3aW5kb3csIGRvY3VtZW50KTtcclxuXHJcbi8qKlxyXG4gKiBOYXZpZ2F0aW9uIFBsdWdpblxyXG4gKiBAdmVyc2lvbiAyLjMuNFxyXG4gKiBAYXV0aG9yIEFydHVzIEtvbGFub3dza2lcclxuICogQGF1dGhvciBEYXZpZCBEZXV0c2NoXHJcbiAqIEBsaWNlbnNlIFRoZSBNSVQgTGljZW5zZSAoTUlUKVxyXG4gKi9cclxuOyhmdW5jdGlvbigkLCB3aW5kb3csIGRvY3VtZW50LCB1bmRlZmluZWQpIHtcclxuXHQndXNlIHN0cmljdCc7XHJcblxyXG5cdC8qKlxyXG5cdCAqIENyZWF0ZXMgdGhlIG5hdmlnYXRpb24gcGx1Z2luLlxyXG5cdCAqIEBjbGFzcyBUaGUgTmF2aWdhdGlvbiBQbHVnaW5cclxuXHQgKiBAcGFyYW0ge093bH0gY2Fyb3VzZWwgLSBUaGUgT3dsIENhcm91c2VsLlxyXG5cdCAqL1xyXG5cdHZhciBOYXZpZ2F0aW9uID0gZnVuY3Rpb24oY2Fyb3VzZWwpIHtcclxuXHRcdC8qKlxyXG5cdFx0ICogUmVmZXJlbmNlIHRvIHRoZSBjb3JlLlxyXG5cdFx0ICogQHByb3RlY3RlZFxyXG5cdFx0ICogQHR5cGUge093bH1cclxuXHRcdCAqL1xyXG5cdFx0dGhpcy5fY29yZSA9IGNhcm91c2VsO1xyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogSW5kaWNhdGVzIHdoZXRoZXIgdGhlIHBsdWdpbiBpcyBpbml0aWFsaXplZCBvciBub3QuXHJcblx0XHQgKiBAcHJvdGVjdGVkXHJcblx0XHQgKiBAdHlwZSB7Qm9vbGVhbn1cclxuXHRcdCAqL1xyXG5cdFx0dGhpcy5faW5pdGlhbGl6ZWQgPSBmYWxzZTtcclxuXHJcblx0XHQvKipcclxuXHRcdCAqIFRoZSBjdXJyZW50IHBhZ2luZyBpbmRleGVzLlxyXG5cdFx0ICogQHByb3RlY3RlZFxyXG5cdFx0ICogQHR5cGUge0FycmF5fVxyXG5cdFx0ICovXHJcblx0XHR0aGlzLl9wYWdlcyA9IFtdO1xyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogQWxsIERPTSBlbGVtZW50cyBvZiB0aGUgdXNlciBpbnRlcmZhY2UuXHJcblx0XHQgKiBAcHJvdGVjdGVkXHJcblx0XHQgKiBAdHlwZSB7T2JqZWN0fVxyXG5cdFx0ICovXHJcblx0XHR0aGlzLl9jb250cm9scyA9IHt9O1xyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogTWFya3VwIGZvciBhbiBpbmRpY2F0b3IuXHJcblx0XHQgKiBAcHJvdGVjdGVkXHJcblx0XHQgKiBAdHlwZSB7QXJyYXkuPFN0cmluZz59XHJcblx0XHQgKi9cclxuXHRcdHRoaXMuX3RlbXBsYXRlcyA9IFtdO1xyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogVGhlIGNhcm91c2VsIGVsZW1lbnQuXHJcblx0XHQgKiBAdHlwZSB7alF1ZXJ5fVxyXG5cdFx0ICovXHJcblx0XHR0aGlzLiRlbGVtZW50ID0gdGhpcy5fY29yZS4kZWxlbWVudDtcclxuXHJcblx0XHQvKipcclxuXHRcdCAqIE92ZXJyaWRkZW4gbWV0aG9kcyBvZiB0aGUgY2Fyb3VzZWwuXHJcblx0XHQgKiBAcHJvdGVjdGVkXHJcblx0XHQgKiBAdHlwZSB7T2JqZWN0fVxyXG5cdFx0ICovXHJcblx0XHR0aGlzLl9vdmVycmlkZXMgPSB7XHJcblx0XHRcdG5leHQ6IHRoaXMuX2NvcmUubmV4dCxcclxuXHRcdFx0cHJldjogdGhpcy5fY29yZS5wcmV2LFxyXG5cdFx0XHR0bzogdGhpcy5fY29yZS50b1xyXG5cdFx0fTtcclxuXHJcblx0XHQvKipcclxuXHRcdCAqIEFsbCBldmVudCBoYW5kbGVycy5cclxuXHRcdCAqIEBwcm90ZWN0ZWRcclxuXHRcdCAqIEB0eXBlIHtPYmplY3R9XHJcblx0XHQgKi9cclxuXHRcdHRoaXMuX2hhbmRsZXJzID0ge1xyXG5cdFx0XHQncHJlcGFyZWQub3dsLmNhcm91c2VsJzogJC5wcm94eShmdW5jdGlvbihlKSB7XHJcblx0XHRcdFx0aWYgKGUubmFtZXNwYWNlICYmIHRoaXMuX2NvcmUuc2V0dGluZ3MuZG90c0RhdGEpIHtcclxuXHRcdFx0XHRcdHRoaXMuX3RlbXBsYXRlcy5wdXNoKCc8ZGl2IGNsYXNzPVwiJyArIHRoaXMuX2NvcmUuc2V0dGluZ3MuZG90Q2xhc3MgKyAnXCI+JyArXHJcblx0XHRcdFx0XHRcdCQoZS5jb250ZW50KS5maW5kKCdbZGF0YS1kb3RdJykuYWRkQmFjaygnW2RhdGEtZG90XScpLmF0dHIoJ2RhdGEtZG90JykgKyAnPC9kaXY+Jyk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9LCB0aGlzKSxcclxuXHRcdFx0J2FkZGVkLm93bC5jYXJvdXNlbCc6ICQucHJveHkoZnVuY3Rpb24oZSkge1xyXG5cdFx0XHRcdGlmIChlLm5hbWVzcGFjZSAmJiB0aGlzLl9jb3JlLnNldHRpbmdzLmRvdHNEYXRhKSB7XHJcblx0XHRcdFx0XHR0aGlzLl90ZW1wbGF0ZXMuc3BsaWNlKGUucG9zaXRpb24sIDAsIHRoaXMuX3RlbXBsYXRlcy5wb3AoKSk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9LCB0aGlzKSxcclxuXHRcdFx0J3JlbW92ZS5vd2wuY2Fyb3VzZWwnOiAkLnByb3h5KGZ1bmN0aW9uKGUpIHtcclxuXHRcdFx0XHRpZiAoZS5uYW1lc3BhY2UgJiYgdGhpcy5fY29yZS5zZXR0aW5ncy5kb3RzRGF0YSkge1xyXG5cdFx0XHRcdFx0dGhpcy5fdGVtcGxhdGVzLnNwbGljZShlLnBvc2l0aW9uLCAxKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH0sIHRoaXMpLFxyXG5cdFx0XHQnY2hhbmdlZC5vd2wuY2Fyb3VzZWwnOiAkLnByb3h5KGZ1bmN0aW9uKGUpIHtcclxuXHRcdFx0XHRpZiAoZS5uYW1lc3BhY2UgJiYgZS5wcm9wZXJ0eS5uYW1lID09ICdwb3NpdGlvbicpIHtcclxuXHRcdFx0XHRcdHRoaXMuZHJhdygpO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fSwgdGhpcyksXHJcblx0XHRcdCdpbml0aWFsaXplZC5vd2wuY2Fyb3VzZWwnOiAkLnByb3h5KGZ1bmN0aW9uKGUpIHtcclxuXHRcdFx0XHRpZiAoZS5uYW1lc3BhY2UgJiYgIXRoaXMuX2luaXRpYWxpemVkKSB7XHJcblx0XHRcdFx0XHR0aGlzLl9jb3JlLnRyaWdnZXIoJ2luaXRpYWxpemUnLCBudWxsLCAnbmF2aWdhdGlvbicpO1xyXG5cdFx0XHRcdFx0dGhpcy5pbml0aWFsaXplKCk7XHJcblx0XHRcdFx0XHR0aGlzLnVwZGF0ZSgpO1xyXG5cdFx0XHRcdFx0dGhpcy5kcmF3KCk7XHJcblx0XHRcdFx0XHR0aGlzLl9pbml0aWFsaXplZCA9IHRydWU7XHJcblx0XHRcdFx0XHR0aGlzLl9jb3JlLnRyaWdnZXIoJ2luaXRpYWxpemVkJywgbnVsbCwgJ25hdmlnYXRpb24nKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH0sIHRoaXMpLFxyXG5cdFx0XHQncmVmcmVzaGVkLm93bC5jYXJvdXNlbCc6ICQucHJveHkoZnVuY3Rpb24oZSkge1xyXG5cdFx0XHRcdGlmIChlLm5hbWVzcGFjZSAmJiB0aGlzLl9pbml0aWFsaXplZCkge1xyXG5cdFx0XHRcdFx0dGhpcy5fY29yZS50cmlnZ2VyKCdyZWZyZXNoJywgbnVsbCwgJ25hdmlnYXRpb24nKTtcclxuXHRcdFx0XHRcdHRoaXMudXBkYXRlKCk7XHJcblx0XHRcdFx0XHR0aGlzLmRyYXcoKTtcclxuXHRcdFx0XHRcdHRoaXMuX2NvcmUudHJpZ2dlcigncmVmcmVzaGVkJywgbnVsbCwgJ25hdmlnYXRpb24nKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH0sIHRoaXMpXHJcblx0XHR9O1xyXG5cclxuXHRcdC8vIHNldCBkZWZhdWx0IG9wdGlvbnNcclxuXHRcdHRoaXMuX2NvcmUub3B0aW9ucyA9ICQuZXh0ZW5kKHt9LCBOYXZpZ2F0aW9uLkRlZmF1bHRzLCB0aGlzLl9jb3JlLm9wdGlvbnMpO1xyXG5cclxuXHRcdC8vIHJlZ2lzdGVyIGV2ZW50IGhhbmRsZXJzXHJcblx0XHR0aGlzLiRlbGVtZW50Lm9uKHRoaXMuX2hhbmRsZXJzKTtcclxuXHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiBEZWZhdWx0IG9wdGlvbnMuXHJcblx0ICogQHB1YmxpY1xyXG5cdCAqIEB0b2RvIFJlbmFtZSBgc2xpZGVCeWAgdG8gYG5hdkJ5YFxyXG5cdCAqL1xyXG5cdE5hdmlnYXRpb24uRGVmYXVsdHMgPSB7XHJcblx0XHRuYXY6IGZhbHNlLFxyXG5cdFx0bmF2VGV4dDogW1xyXG5cdFx0XHQnPHNwYW4gYXJpYS1sYWJlbD1cIicgKyAnUHJldmlvdXMnICsgJ1wiPiYjeDIwMzk7PC9zcGFuPicsXHJcblx0XHRcdCc8c3BhbiBhcmlhLWxhYmVsPVwiJyArICdOZXh0JyArICdcIj4mI3gyMDNhOzwvc3Bhbj4nXHJcblx0XHRdLFxyXG5cdFx0bmF2U3BlZWQ6IGZhbHNlLFxyXG5cdFx0bmF2RWxlbWVudDogJ2J1dHRvbiB0eXBlPVwiYnV0dG9uXCIgcm9sZT1cInByZXNlbnRhdGlvblwiJyxcclxuXHRcdG5hdkNvbnRhaW5lcjogZmFsc2UsXHJcblx0XHRuYXZDb250YWluZXJDbGFzczogJ293bC1uYXYnLFxyXG5cdFx0bmF2Q2xhc3M6IFtcclxuXHRcdFx0J293bC1wcmV2JyxcclxuXHRcdFx0J293bC1uZXh0J1xyXG5cdFx0XSxcclxuXHRcdHNsaWRlQnk6IDEsXHJcblx0XHRkb3RDbGFzczogJ293bC1kb3QnLFxyXG5cdFx0ZG90c0NsYXNzOiAnb3dsLWRvdHMnLFxyXG5cdFx0ZG90czogdHJ1ZSxcclxuXHRcdGRvdHNFYWNoOiBmYWxzZSxcclxuXHRcdGRvdHNEYXRhOiBmYWxzZSxcclxuXHRcdGRvdHNTcGVlZDogZmFsc2UsXHJcblx0XHRkb3RzQ29udGFpbmVyOiBmYWxzZVxyXG5cdH07XHJcblxyXG5cdC8qKlxyXG5cdCAqIEluaXRpYWxpemVzIHRoZSBsYXlvdXQgb2YgdGhlIHBsdWdpbiBhbmQgZXh0ZW5kcyB0aGUgY2Fyb3VzZWwuXHJcblx0ICogQHByb3RlY3RlZFxyXG5cdCAqL1xyXG5cdE5hdmlnYXRpb24ucHJvdG90eXBlLmluaXRpYWxpemUgPSBmdW5jdGlvbigpIHtcclxuXHRcdHZhciBvdmVycmlkZSxcclxuXHRcdFx0c2V0dGluZ3MgPSB0aGlzLl9jb3JlLnNldHRpbmdzO1xyXG5cclxuXHRcdC8vIGNyZWF0ZSBET00gc3RydWN0dXJlIGZvciByZWxhdGl2ZSBuYXZpZ2F0aW9uXHJcblx0XHR0aGlzLl9jb250cm9scy4kcmVsYXRpdmUgPSAoc2V0dGluZ3MubmF2Q29udGFpbmVyID8gJChzZXR0aW5ncy5uYXZDb250YWluZXIpXHJcblx0XHRcdDogJCgnPGRpdj4nKS5hZGRDbGFzcyhzZXR0aW5ncy5uYXZDb250YWluZXJDbGFzcykuYXBwZW5kVG8odGhpcy4kZWxlbWVudCkpLmFkZENsYXNzKCdkaXNhYmxlZCcpO1xyXG5cclxuXHRcdHRoaXMuX2NvbnRyb2xzLiRwcmV2aW91cyA9ICQoJzwnICsgc2V0dGluZ3MubmF2RWxlbWVudCArICc+JylcclxuXHRcdFx0LmFkZENsYXNzKHNldHRpbmdzLm5hdkNsYXNzWzBdKVxyXG5cdFx0XHQuaHRtbChzZXR0aW5ncy5uYXZUZXh0WzBdKVxyXG5cdFx0XHQucHJlcGVuZFRvKHRoaXMuX2NvbnRyb2xzLiRyZWxhdGl2ZSlcclxuXHRcdFx0Lm9uKCdjbGljaycsICQucHJveHkoZnVuY3Rpb24oZSkge1xyXG5cdFx0XHRcdHRoaXMucHJldihzZXR0aW5ncy5uYXZTcGVlZCk7XHJcblx0XHRcdH0sIHRoaXMpKTtcclxuXHRcdHRoaXMuX2NvbnRyb2xzLiRuZXh0ID0gJCgnPCcgKyBzZXR0aW5ncy5uYXZFbGVtZW50ICsgJz4nKVxyXG5cdFx0XHQuYWRkQ2xhc3Moc2V0dGluZ3MubmF2Q2xhc3NbMV0pXHJcblx0XHRcdC5odG1sKHNldHRpbmdzLm5hdlRleHRbMV0pXHJcblx0XHRcdC5hcHBlbmRUbyh0aGlzLl9jb250cm9scy4kcmVsYXRpdmUpXHJcblx0XHRcdC5vbignY2xpY2snLCAkLnByb3h5KGZ1bmN0aW9uKGUpIHtcclxuXHRcdFx0XHR0aGlzLm5leHQoc2V0dGluZ3MubmF2U3BlZWQpO1xyXG5cdFx0XHR9LCB0aGlzKSk7XHJcblxyXG5cdFx0Ly8gY3JlYXRlIERPTSBzdHJ1Y3R1cmUgZm9yIGFic29sdXRlIG5hdmlnYXRpb25cclxuXHRcdGlmICghc2V0dGluZ3MuZG90c0RhdGEpIHtcclxuXHRcdFx0dGhpcy5fdGVtcGxhdGVzID0gWyAkKCc8YnV0dG9uIHJvbGU9XCJidXR0b25cIj4nKVxyXG5cdFx0XHRcdC5hZGRDbGFzcyhzZXR0aW5ncy5kb3RDbGFzcylcclxuXHRcdFx0XHQuYXBwZW5kKCQoJzxzcGFuPicpKVxyXG5cdFx0XHRcdC5wcm9wKCdvdXRlckhUTUwnKSBdO1xyXG5cdFx0fVxyXG5cclxuXHRcdHRoaXMuX2NvbnRyb2xzLiRhYnNvbHV0ZSA9IChzZXR0aW5ncy5kb3RzQ29udGFpbmVyID8gJChzZXR0aW5ncy5kb3RzQ29udGFpbmVyKVxyXG5cdFx0XHQ6ICQoJzxkaXY+JykuYWRkQ2xhc3Moc2V0dGluZ3MuZG90c0NsYXNzKS5hcHBlbmRUbyh0aGlzLiRlbGVtZW50KSkuYWRkQ2xhc3MoJ2Rpc2FibGVkJyk7XHJcblxyXG5cdFx0dGhpcy5fY29udHJvbHMuJGFic29sdXRlLm9uKCdjbGljaycsICdidXR0b24nLCAkLnByb3h5KGZ1bmN0aW9uKGUpIHtcclxuXHRcdFx0dmFyIGluZGV4ID0gJChlLnRhcmdldCkucGFyZW50KCkuaXModGhpcy5fY29udHJvbHMuJGFic29sdXRlKVxyXG5cdFx0XHRcdD8gJChlLnRhcmdldCkuaW5kZXgoKSA6ICQoZS50YXJnZXQpLnBhcmVudCgpLmluZGV4KCk7XHJcblxyXG5cdFx0XHRlLnByZXZlbnREZWZhdWx0KCk7XHJcblxyXG5cdFx0XHR0aGlzLnRvKGluZGV4LCBzZXR0aW5ncy5kb3RzU3BlZWQpO1xyXG5cdFx0fSwgdGhpcykpO1xyXG5cclxuXHRcdC8qJGVsLm9uKCdmb2N1c2luJywgZnVuY3Rpb24oKSB7XHJcblx0XHRcdCQoZG9jdW1lbnQpLm9mZihcIi5jYXJvdXNlbFwiKTtcclxuXHJcblx0XHRcdCQoZG9jdW1lbnQpLm9uKCdrZXlkb3duLmNhcm91c2VsJywgZnVuY3Rpb24oZSkge1xyXG5cdFx0XHRcdGlmKGUua2V5Q29kZSA9PSAzNykge1xyXG5cdFx0XHRcdFx0JGVsLnRyaWdnZXIoJ3ByZXYub3dsJylcclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0aWYoZS5rZXlDb2RlID09IDM5KSB7XHJcblx0XHRcdFx0XHQkZWwudHJpZ2dlcignbmV4dC5vd2wnKVxyXG5cdFx0XHRcdH1cclxuXHRcdFx0fSk7XHJcblx0XHR9KTsqL1xyXG5cclxuXHRcdC8vIG92ZXJyaWRlIHB1YmxpYyBtZXRob2RzIG9mIHRoZSBjYXJvdXNlbFxyXG5cdFx0Zm9yIChvdmVycmlkZSBpbiB0aGlzLl9vdmVycmlkZXMpIHtcclxuXHRcdFx0dGhpcy5fY29yZVtvdmVycmlkZV0gPSAkLnByb3h5KHRoaXNbb3ZlcnJpZGVdLCB0aGlzKTtcclxuXHRcdH1cclxuXHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiBEZXN0cm95cyB0aGUgcGx1Z2luLlxyXG5cdCAqIEBwcm90ZWN0ZWRcclxuXHQgKi9cclxuXHROYXZpZ2F0aW9uLnByb3RvdHlwZS5kZXN0cm95ID0gZnVuY3Rpb24oKSB7XHJcblx0XHR2YXIgaGFuZGxlciwgY29udHJvbCwgcHJvcGVydHksIG92ZXJyaWRlLCBzZXR0aW5ncztcclxuXHRcdHNldHRpbmdzID0gdGhpcy5fY29yZS5zZXR0aW5ncztcclxuXHJcblx0XHRmb3IgKGhhbmRsZXIgaW4gdGhpcy5faGFuZGxlcnMpIHtcclxuXHRcdFx0dGhpcy4kZWxlbWVudC5vZmYoaGFuZGxlciwgdGhpcy5faGFuZGxlcnNbaGFuZGxlcl0pO1xyXG5cdFx0fVxyXG5cdFx0Zm9yIChjb250cm9sIGluIHRoaXMuX2NvbnRyb2xzKSB7XHJcblx0XHRcdGlmIChjb250cm9sID09PSAnJHJlbGF0aXZlJyAmJiBzZXR0aW5ncy5uYXZDb250YWluZXIpIHtcclxuXHRcdFx0XHR0aGlzLl9jb250cm9sc1tjb250cm9sXS5odG1sKCcnKTtcclxuXHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHR0aGlzLl9jb250cm9sc1tjb250cm9sXS5yZW1vdmUoKTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cdFx0Zm9yIChvdmVycmlkZSBpbiB0aGlzLm92ZXJpZGVzKSB7XHJcblx0XHRcdHRoaXMuX2NvcmVbb3ZlcnJpZGVdID0gdGhpcy5fb3ZlcnJpZGVzW292ZXJyaWRlXTtcclxuXHRcdH1cclxuXHRcdGZvciAocHJvcGVydHkgaW4gT2JqZWN0LmdldE93blByb3BlcnR5TmFtZXModGhpcykpIHtcclxuXHRcdFx0dHlwZW9mIHRoaXNbcHJvcGVydHldICE9ICdmdW5jdGlvbicgJiYgKHRoaXNbcHJvcGVydHldID0gbnVsbCk7XHJcblx0XHR9XHJcblx0fTtcclxuXHJcblx0LyoqXHJcblx0ICogVXBkYXRlcyB0aGUgaW50ZXJuYWwgc3RhdGUuXHJcblx0ICogQHByb3RlY3RlZFxyXG5cdCAqL1xyXG5cdE5hdmlnYXRpb24ucHJvdG90eXBlLnVwZGF0ZSA9IGZ1bmN0aW9uKCkge1xyXG5cdFx0dmFyIGksIGosIGssXHJcblx0XHRcdGxvd2VyID0gdGhpcy5fY29yZS5jbG9uZXMoKS5sZW5ndGggLyAyLFxyXG5cdFx0XHR1cHBlciA9IGxvd2VyICsgdGhpcy5fY29yZS5pdGVtcygpLmxlbmd0aCxcclxuXHRcdFx0bWF4aW11bSA9IHRoaXMuX2NvcmUubWF4aW11bSh0cnVlKSxcclxuXHRcdFx0c2V0dGluZ3MgPSB0aGlzLl9jb3JlLnNldHRpbmdzLFxyXG5cdFx0XHRzaXplID0gc2V0dGluZ3MuY2VudGVyIHx8IHNldHRpbmdzLmF1dG9XaWR0aCB8fCBzZXR0aW5ncy5kb3RzRGF0YVxyXG5cdFx0XHRcdD8gMSA6IHNldHRpbmdzLmRvdHNFYWNoIHx8IHNldHRpbmdzLml0ZW1zO1xyXG5cclxuXHRcdGlmIChzZXR0aW5ncy5zbGlkZUJ5ICE9PSAncGFnZScpIHtcclxuXHRcdFx0c2V0dGluZ3Muc2xpZGVCeSA9IE1hdGgubWluKHNldHRpbmdzLnNsaWRlQnksIHNldHRpbmdzLml0ZW1zKTtcclxuXHRcdH1cclxuXHJcblx0XHRpZiAoc2V0dGluZ3MuZG90cyB8fCBzZXR0aW5ncy5zbGlkZUJ5ID09ICdwYWdlJykge1xyXG5cdFx0XHR0aGlzLl9wYWdlcyA9IFtdO1xyXG5cclxuXHRcdFx0Zm9yIChpID0gbG93ZXIsIGogPSAwLCBrID0gMDsgaSA8IHVwcGVyOyBpKyspIHtcclxuXHRcdFx0XHRpZiAoaiA+PSBzaXplIHx8IGogPT09IDApIHtcclxuXHRcdFx0XHRcdHRoaXMuX3BhZ2VzLnB1c2goe1xyXG5cdFx0XHRcdFx0XHRzdGFydDogTWF0aC5taW4obWF4aW11bSwgaSAtIGxvd2VyKSxcclxuXHRcdFx0XHRcdFx0ZW5kOiBpIC0gbG93ZXIgKyBzaXplIC0gMVxyXG5cdFx0XHRcdFx0fSk7XHJcblx0XHRcdFx0XHRpZiAoTWF0aC5taW4obWF4aW11bSwgaSAtIGxvd2VyKSA9PT0gbWF4aW11bSkge1xyXG5cdFx0XHRcdFx0XHRicmVhaztcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdGogPSAwLCArK2s7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcdGogKz0gdGhpcy5fY29yZS5tZXJnZXJzKHRoaXMuX2NvcmUucmVsYXRpdmUoaSkpO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblx0fTtcclxuXHJcblx0LyoqXHJcblx0ICogRHJhd3MgdGhlIHVzZXIgaW50ZXJmYWNlLlxyXG5cdCAqIEB0b2RvIFRoZSBvcHRpb24gYGRvdHNEYXRhYCB3b250IHdvcmsuXHJcblx0ICogQHByb3RlY3RlZFxyXG5cdCAqL1xyXG5cdE5hdmlnYXRpb24ucHJvdG90eXBlLmRyYXcgPSBmdW5jdGlvbigpIHtcclxuXHRcdHZhciBkaWZmZXJlbmNlLFxyXG5cdFx0XHRzZXR0aW5ncyA9IHRoaXMuX2NvcmUuc2V0dGluZ3MsXHJcblx0XHRcdGRpc2FibGVkID0gdGhpcy5fY29yZS5pdGVtcygpLmxlbmd0aCA8PSBzZXR0aW5ncy5pdGVtcyxcclxuXHRcdFx0aW5kZXggPSB0aGlzLl9jb3JlLnJlbGF0aXZlKHRoaXMuX2NvcmUuY3VycmVudCgpKSxcclxuXHRcdFx0bG9vcCA9IHNldHRpbmdzLmxvb3AgfHwgc2V0dGluZ3MucmV3aW5kO1xyXG5cclxuXHRcdHRoaXMuX2NvbnRyb2xzLiRyZWxhdGl2ZS50b2dnbGVDbGFzcygnZGlzYWJsZWQnLCAhc2V0dGluZ3MubmF2IHx8IGRpc2FibGVkKTtcclxuXHJcblx0XHRpZiAoc2V0dGluZ3MubmF2KSB7XHJcblx0XHRcdHRoaXMuX2NvbnRyb2xzLiRwcmV2aW91cy50b2dnbGVDbGFzcygnZGlzYWJsZWQnLCAhbG9vcCAmJiBpbmRleCA8PSB0aGlzLl9jb3JlLm1pbmltdW0odHJ1ZSkpO1xyXG5cdFx0XHR0aGlzLl9jb250cm9scy4kbmV4dC50b2dnbGVDbGFzcygnZGlzYWJsZWQnLCAhbG9vcCAmJiBpbmRleCA+PSB0aGlzLl9jb3JlLm1heGltdW0odHJ1ZSkpO1xyXG5cdFx0fVxyXG5cclxuXHRcdHRoaXMuX2NvbnRyb2xzLiRhYnNvbHV0ZS50b2dnbGVDbGFzcygnZGlzYWJsZWQnLCAhc2V0dGluZ3MuZG90cyB8fCBkaXNhYmxlZCk7XHJcblxyXG5cdFx0aWYgKHNldHRpbmdzLmRvdHMpIHtcclxuXHRcdFx0ZGlmZmVyZW5jZSA9IHRoaXMuX3BhZ2VzLmxlbmd0aCAtIHRoaXMuX2NvbnRyb2xzLiRhYnNvbHV0ZS5jaGlsZHJlbigpLmxlbmd0aDtcclxuXHJcblx0XHRcdGlmIChzZXR0aW5ncy5kb3RzRGF0YSAmJiBkaWZmZXJlbmNlICE9PSAwKSB7XHJcblx0XHRcdFx0dGhpcy5fY29udHJvbHMuJGFic29sdXRlLmh0bWwodGhpcy5fdGVtcGxhdGVzLmpvaW4oJycpKTtcclxuXHRcdFx0fSBlbHNlIGlmIChkaWZmZXJlbmNlID4gMCkge1xyXG5cdFx0XHRcdHRoaXMuX2NvbnRyb2xzLiRhYnNvbHV0ZS5hcHBlbmQobmV3IEFycmF5KGRpZmZlcmVuY2UgKyAxKS5qb2luKHRoaXMuX3RlbXBsYXRlc1swXSkpO1xyXG5cdFx0XHR9IGVsc2UgaWYgKGRpZmZlcmVuY2UgPCAwKSB7XHJcblx0XHRcdFx0dGhpcy5fY29udHJvbHMuJGFic29sdXRlLmNoaWxkcmVuKCkuc2xpY2UoZGlmZmVyZW5jZSkucmVtb3ZlKCk7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdHRoaXMuX2NvbnRyb2xzLiRhYnNvbHV0ZS5maW5kKCcuYWN0aXZlJykucmVtb3ZlQ2xhc3MoJ2FjdGl2ZScpO1xyXG5cdFx0XHR0aGlzLl9jb250cm9scy4kYWJzb2x1dGUuY2hpbGRyZW4oKS5lcSgkLmluQXJyYXkodGhpcy5jdXJyZW50KCksIHRoaXMuX3BhZ2VzKSkuYWRkQ2xhc3MoJ2FjdGl2ZScpO1xyXG5cdFx0fVxyXG5cdH07XHJcblxyXG5cdC8qKlxyXG5cdCAqIEV4dGVuZHMgZXZlbnQgZGF0YS5cclxuXHQgKiBAcHJvdGVjdGVkXHJcblx0ICogQHBhcmFtIHtFdmVudH0gZXZlbnQgLSBUaGUgZXZlbnQgb2JqZWN0IHdoaWNoIGdldHMgdGhyb3duLlxyXG5cdCAqL1xyXG5cdE5hdmlnYXRpb24ucHJvdG90eXBlLm9uVHJpZ2dlciA9IGZ1bmN0aW9uKGV2ZW50KSB7XHJcblx0XHR2YXIgc2V0dGluZ3MgPSB0aGlzLl9jb3JlLnNldHRpbmdzO1xyXG5cclxuXHRcdGV2ZW50LnBhZ2UgPSB7XHJcblx0XHRcdGluZGV4OiAkLmluQXJyYXkodGhpcy5jdXJyZW50KCksIHRoaXMuX3BhZ2VzKSxcclxuXHRcdFx0Y291bnQ6IHRoaXMuX3BhZ2VzLmxlbmd0aCxcclxuXHRcdFx0c2l6ZTogc2V0dGluZ3MgJiYgKHNldHRpbmdzLmNlbnRlciB8fCBzZXR0aW5ncy5hdXRvV2lkdGggfHwgc2V0dGluZ3MuZG90c0RhdGFcclxuXHRcdFx0XHQ/IDEgOiBzZXR0aW5ncy5kb3RzRWFjaCB8fCBzZXR0aW5ncy5pdGVtcylcclxuXHRcdH07XHJcblx0fTtcclxuXHJcblx0LyoqXHJcblx0ICogR2V0cyB0aGUgY3VycmVudCBwYWdlIHBvc2l0aW9uIG9mIHRoZSBjYXJvdXNlbC5cclxuXHQgKiBAcHJvdGVjdGVkXHJcblx0ICogQHJldHVybnMge051bWJlcn1cclxuXHQgKi9cclxuXHROYXZpZ2F0aW9uLnByb3RvdHlwZS5jdXJyZW50ID0gZnVuY3Rpb24oKSB7XHJcblx0XHR2YXIgY3VycmVudCA9IHRoaXMuX2NvcmUucmVsYXRpdmUodGhpcy5fY29yZS5jdXJyZW50KCkpO1xyXG5cdFx0cmV0dXJuICQuZ3JlcCh0aGlzLl9wYWdlcywgJC5wcm94eShmdW5jdGlvbihwYWdlLCBpbmRleCkge1xyXG5cdFx0XHRyZXR1cm4gcGFnZS5zdGFydCA8PSBjdXJyZW50ICYmIHBhZ2UuZW5kID49IGN1cnJlbnQ7XHJcblx0XHR9LCB0aGlzKSkucG9wKCk7XHJcblx0fTtcclxuXHJcblx0LyoqXHJcblx0ICogR2V0cyB0aGUgY3VycmVudCBzdWNjZXNvci9wcmVkZWNlc3NvciBwb3NpdGlvbi5cclxuXHQgKiBAcHJvdGVjdGVkXHJcblx0ICogQHJldHVybnMge051bWJlcn1cclxuXHQgKi9cclxuXHROYXZpZ2F0aW9uLnByb3RvdHlwZS5nZXRQb3NpdGlvbiA9IGZ1bmN0aW9uKHN1Y2Nlc3Nvcikge1xyXG5cdFx0dmFyIHBvc2l0aW9uLCBsZW5ndGgsXHJcblx0XHRcdHNldHRpbmdzID0gdGhpcy5fY29yZS5zZXR0aW5ncztcclxuXHJcblx0XHRpZiAoc2V0dGluZ3Muc2xpZGVCeSA9PSAncGFnZScpIHtcclxuXHRcdFx0cG9zaXRpb24gPSAkLmluQXJyYXkodGhpcy5jdXJyZW50KCksIHRoaXMuX3BhZ2VzKTtcclxuXHRcdFx0bGVuZ3RoID0gdGhpcy5fcGFnZXMubGVuZ3RoO1xyXG5cdFx0XHRzdWNjZXNzb3IgPyArK3Bvc2l0aW9uIDogLS1wb3NpdGlvbjtcclxuXHRcdFx0cG9zaXRpb24gPSB0aGlzLl9wYWdlc1soKHBvc2l0aW9uICUgbGVuZ3RoKSArIGxlbmd0aCkgJSBsZW5ndGhdLnN0YXJ0O1xyXG5cdFx0fSBlbHNlIHtcclxuXHRcdFx0cG9zaXRpb24gPSB0aGlzLl9jb3JlLnJlbGF0aXZlKHRoaXMuX2NvcmUuY3VycmVudCgpKTtcclxuXHRcdFx0bGVuZ3RoID0gdGhpcy5fY29yZS5pdGVtcygpLmxlbmd0aDtcclxuXHRcdFx0c3VjY2Vzc29yID8gcG9zaXRpb24gKz0gc2V0dGluZ3Muc2xpZGVCeSA6IHBvc2l0aW9uIC09IHNldHRpbmdzLnNsaWRlQnk7XHJcblx0XHR9XHJcblxyXG5cdFx0cmV0dXJuIHBvc2l0aW9uO1xyXG5cdH07XHJcblxyXG5cdC8qKlxyXG5cdCAqIFNsaWRlcyB0byB0aGUgbmV4dCBpdGVtIG9yIHBhZ2UuXHJcblx0ICogQHB1YmxpY1xyXG5cdCAqIEBwYXJhbSB7TnVtYmVyfSBbc3BlZWQ9ZmFsc2VdIC0gVGhlIHRpbWUgaW4gbWlsbGlzZWNvbmRzIGZvciB0aGUgdHJhbnNpdGlvbi5cclxuXHQgKi9cclxuXHROYXZpZ2F0aW9uLnByb3RvdHlwZS5uZXh0ID0gZnVuY3Rpb24oc3BlZWQpIHtcclxuXHRcdCQucHJveHkodGhpcy5fb3ZlcnJpZGVzLnRvLCB0aGlzLl9jb3JlKSh0aGlzLmdldFBvc2l0aW9uKHRydWUpLCBzcGVlZCk7XHJcblx0fTtcclxuXHJcblx0LyoqXHJcblx0ICogU2xpZGVzIHRvIHRoZSBwcmV2aW91cyBpdGVtIG9yIHBhZ2UuXHJcblx0ICogQHB1YmxpY1xyXG5cdCAqIEBwYXJhbSB7TnVtYmVyfSBbc3BlZWQ9ZmFsc2VdIC0gVGhlIHRpbWUgaW4gbWlsbGlzZWNvbmRzIGZvciB0aGUgdHJhbnNpdGlvbi5cclxuXHQgKi9cclxuXHROYXZpZ2F0aW9uLnByb3RvdHlwZS5wcmV2ID0gZnVuY3Rpb24oc3BlZWQpIHtcclxuXHRcdCQucHJveHkodGhpcy5fb3ZlcnJpZGVzLnRvLCB0aGlzLl9jb3JlKSh0aGlzLmdldFBvc2l0aW9uKGZhbHNlKSwgc3BlZWQpO1xyXG5cdH07XHJcblxyXG5cdC8qKlxyXG5cdCAqIFNsaWRlcyB0byB0aGUgc3BlY2lmaWVkIGl0ZW0gb3IgcGFnZS5cclxuXHQgKiBAcHVibGljXHJcblx0ICogQHBhcmFtIHtOdW1iZXJ9IHBvc2l0aW9uIC0gVGhlIHBvc2l0aW9uIG9mIHRoZSBpdGVtIG9yIHBhZ2UuXHJcblx0ICogQHBhcmFtIHtOdW1iZXJ9IFtzcGVlZF0gLSBUaGUgdGltZSBpbiBtaWxsaXNlY29uZHMgZm9yIHRoZSB0cmFuc2l0aW9uLlxyXG5cdCAqIEBwYXJhbSB7Qm9vbGVhbn0gW3N0YW5kYXJkPWZhbHNlXSAtIFdoZXRoZXIgdG8gdXNlIHRoZSBzdGFuZGFyZCBiZWhhdmlvdXIgb3Igbm90LlxyXG5cdCAqL1xyXG5cdE5hdmlnYXRpb24ucHJvdG90eXBlLnRvID0gZnVuY3Rpb24ocG9zaXRpb24sIHNwZWVkLCBzdGFuZGFyZCkge1xyXG5cdFx0dmFyIGxlbmd0aDtcclxuXHJcblx0XHRpZiAoIXN0YW5kYXJkICYmIHRoaXMuX3BhZ2VzLmxlbmd0aCkge1xyXG5cdFx0XHRsZW5ndGggPSB0aGlzLl9wYWdlcy5sZW5ndGg7XHJcblx0XHRcdCQucHJveHkodGhpcy5fb3ZlcnJpZGVzLnRvLCB0aGlzLl9jb3JlKSh0aGlzLl9wYWdlc1soKHBvc2l0aW9uICUgbGVuZ3RoKSArIGxlbmd0aCkgJSBsZW5ndGhdLnN0YXJ0LCBzcGVlZCk7XHJcblx0XHR9IGVsc2Uge1xyXG5cdFx0XHQkLnByb3h5KHRoaXMuX292ZXJyaWRlcy50bywgdGhpcy5fY29yZSkocG9zaXRpb24sIHNwZWVkKTtcclxuXHRcdH1cclxuXHR9O1xyXG5cclxuXHQkLmZuLm93bENhcm91c2VsLkNvbnN0cnVjdG9yLlBsdWdpbnMuTmF2aWdhdGlvbiA9IE5hdmlnYXRpb247XHJcblxyXG59KSh3aW5kb3cuWmVwdG8gfHwgd2luZG93LmpRdWVyeSwgd2luZG93LCBkb2N1bWVudCk7XHJcblxyXG4vKipcclxuICogSGFzaCBQbHVnaW5cclxuICogQHZlcnNpb24gMi4zLjRcclxuICogQGF1dGhvciBBcnR1cyBLb2xhbm93c2tpXHJcbiAqIEBhdXRob3IgRGF2aWQgRGV1dHNjaFxyXG4gKiBAbGljZW5zZSBUaGUgTUlUIExpY2Vuc2UgKE1JVClcclxuICovXHJcbjsoZnVuY3Rpb24oJCwgd2luZG93LCBkb2N1bWVudCwgdW5kZWZpbmVkKSB7XHJcblx0J3VzZSBzdHJpY3QnO1xyXG5cclxuXHQvKipcclxuXHQgKiBDcmVhdGVzIHRoZSBoYXNoIHBsdWdpbi5cclxuXHQgKiBAY2xhc3MgVGhlIEhhc2ggUGx1Z2luXHJcblx0ICogQHBhcmFtIHtPd2x9IGNhcm91c2VsIC0gVGhlIE93bCBDYXJvdXNlbFxyXG5cdCAqL1xyXG5cdHZhciBIYXNoID0gZnVuY3Rpb24oY2Fyb3VzZWwpIHtcclxuXHRcdC8qKlxyXG5cdFx0ICogUmVmZXJlbmNlIHRvIHRoZSBjb3JlLlxyXG5cdFx0ICogQHByb3RlY3RlZFxyXG5cdFx0ICogQHR5cGUge093bH1cclxuXHRcdCAqL1xyXG5cdFx0dGhpcy5fY29yZSA9IGNhcm91c2VsO1xyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogSGFzaCBpbmRleCBmb3IgdGhlIGl0ZW1zLlxyXG5cdFx0ICogQHByb3RlY3RlZFxyXG5cdFx0ICogQHR5cGUge09iamVjdH1cclxuXHRcdCAqL1xyXG5cdFx0dGhpcy5faGFzaGVzID0ge307XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBUaGUgY2Fyb3VzZWwgZWxlbWVudC5cclxuXHRcdCAqIEB0eXBlIHtqUXVlcnl9XHJcblx0XHQgKi9cclxuXHRcdHRoaXMuJGVsZW1lbnQgPSB0aGlzLl9jb3JlLiRlbGVtZW50O1xyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogQWxsIGV2ZW50IGhhbmRsZXJzLlxyXG5cdFx0ICogQHByb3RlY3RlZFxyXG5cdFx0ICogQHR5cGUge09iamVjdH1cclxuXHRcdCAqL1xyXG5cdFx0dGhpcy5faGFuZGxlcnMgPSB7XHJcblx0XHRcdCdpbml0aWFsaXplZC5vd2wuY2Fyb3VzZWwnOiAkLnByb3h5KGZ1bmN0aW9uKGUpIHtcclxuXHRcdFx0XHRpZiAoZS5uYW1lc3BhY2UgJiYgdGhpcy5fY29yZS5zZXR0aW5ncy5zdGFydFBvc2l0aW9uID09PSAnVVJMSGFzaCcpIHtcclxuXHRcdFx0XHRcdCQod2luZG93KS50cmlnZ2VyKCdoYXNoY2hhbmdlLm93bC5uYXZpZ2F0aW9uJyk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9LCB0aGlzKSxcclxuXHRcdFx0J3ByZXBhcmVkLm93bC5jYXJvdXNlbCc6ICQucHJveHkoZnVuY3Rpb24oZSkge1xyXG5cdFx0XHRcdGlmIChlLm5hbWVzcGFjZSkge1xyXG5cdFx0XHRcdFx0dmFyIGhhc2ggPSAkKGUuY29udGVudCkuZmluZCgnW2RhdGEtaGFzaF0nKS5hZGRCYWNrKCdbZGF0YS1oYXNoXScpLmF0dHIoJ2RhdGEtaGFzaCcpO1xyXG5cclxuXHRcdFx0XHRcdGlmICghaGFzaCkge1xyXG5cdFx0XHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdFx0dGhpcy5faGFzaGVzW2hhc2hdID0gZS5jb250ZW50O1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fSwgdGhpcyksXHJcblx0XHRcdCdjaGFuZ2VkLm93bC5jYXJvdXNlbCc6ICQucHJveHkoZnVuY3Rpb24oZSkge1xyXG5cdFx0XHRcdGlmIChlLm5hbWVzcGFjZSAmJiBlLnByb3BlcnR5Lm5hbWUgPT09ICdwb3NpdGlvbicpIHtcclxuXHRcdFx0XHRcdHZhciBjdXJyZW50ID0gdGhpcy5fY29yZS5pdGVtcyh0aGlzLl9jb3JlLnJlbGF0aXZlKHRoaXMuX2NvcmUuY3VycmVudCgpKSksXHJcblx0XHRcdFx0XHRcdGhhc2ggPSAkLm1hcCh0aGlzLl9oYXNoZXMsIGZ1bmN0aW9uKGl0ZW0sIGhhc2gpIHtcclxuXHRcdFx0XHRcdFx0XHRyZXR1cm4gaXRlbSA9PT0gY3VycmVudCA/IGhhc2ggOiBudWxsO1xyXG5cdFx0XHRcdFx0XHR9KS5qb2luKCk7XHJcblxyXG5cdFx0XHRcdFx0aWYgKCFoYXNoIHx8IHdpbmRvdy5sb2NhdGlvbi5oYXNoLnNsaWNlKDEpID09PSBoYXNoKSB7XHJcblx0XHRcdFx0XHRcdHJldHVybjtcclxuXHRcdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0XHR3aW5kb3cubG9jYXRpb24uaGFzaCA9IGhhc2g7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9LCB0aGlzKVxyXG5cdFx0fTtcclxuXHJcblx0XHQvLyBzZXQgZGVmYXVsdCBvcHRpb25zXHJcblx0XHR0aGlzLl9jb3JlLm9wdGlvbnMgPSAkLmV4dGVuZCh7fSwgSGFzaC5EZWZhdWx0cywgdGhpcy5fY29yZS5vcHRpb25zKTtcclxuXHJcblx0XHQvLyByZWdpc3RlciB0aGUgZXZlbnQgaGFuZGxlcnNcclxuXHRcdHRoaXMuJGVsZW1lbnQub24odGhpcy5faGFuZGxlcnMpO1xyXG5cclxuXHRcdC8vIHJlZ2lzdGVyIGV2ZW50IGxpc3RlbmVyIGZvciBoYXNoIG5hdmlnYXRpb25cclxuXHRcdCQod2luZG93KS5vbignaGFzaGNoYW5nZS5vd2wubmF2aWdhdGlvbicsICQucHJveHkoZnVuY3Rpb24oZSkge1xyXG5cdFx0XHR2YXIgaGFzaCA9IHdpbmRvdy5sb2NhdGlvbi5oYXNoLnN1YnN0cmluZygxKSxcclxuXHRcdFx0XHRpdGVtcyA9IHRoaXMuX2NvcmUuJHN0YWdlLmNoaWxkcmVuKCksXHJcblx0XHRcdFx0cG9zaXRpb24gPSB0aGlzLl9oYXNoZXNbaGFzaF0gJiYgaXRlbXMuaW5kZXgodGhpcy5faGFzaGVzW2hhc2hdKTtcclxuXHJcblx0XHRcdGlmIChwb3NpdGlvbiA9PT0gdW5kZWZpbmVkIHx8IHBvc2l0aW9uID09PSB0aGlzLl9jb3JlLmN1cnJlbnQoKSkge1xyXG5cdFx0XHRcdHJldHVybjtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0dGhpcy5fY29yZS50byh0aGlzLl9jb3JlLnJlbGF0aXZlKHBvc2l0aW9uKSwgZmFsc2UsIHRydWUpO1xyXG5cdFx0fSwgdGhpcykpO1xyXG5cdH07XHJcblxyXG5cdC8qKlxyXG5cdCAqIERlZmF1bHQgb3B0aW9ucy5cclxuXHQgKiBAcHVibGljXHJcblx0ICovXHJcblx0SGFzaC5EZWZhdWx0cyA9IHtcclxuXHRcdFVSTGhhc2hMaXN0ZW5lcjogZmFsc2VcclxuXHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiBEZXN0cm95cyB0aGUgcGx1Z2luLlxyXG5cdCAqIEBwdWJsaWNcclxuXHQgKi9cclxuXHRIYXNoLnByb3RvdHlwZS5kZXN0cm95ID0gZnVuY3Rpb24oKSB7XHJcblx0XHR2YXIgaGFuZGxlciwgcHJvcGVydHk7XHJcblxyXG5cdFx0JCh3aW5kb3cpLm9mZignaGFzaGNoYW5nZS5vd2wubmF2aWdhdGlvbicpO1xyXG5cclxuXHRcdGZvciAoaGFuZGxlciBpbiB0aGlzLl9oYW5kbGVycykge1xyXG5cdFx0XHR0aGlzLl9jb3JlLiRlbGVtZW50Lm9mZihoYW5kbGVyLCB0aGlzLl9oYW5kbGVyc1toYW5kbGVyXSk7XHJcblx0XHR9XHJcblx0XHRmb3IgKHByb3BlcnR5IGluIE9iamVjdC5nZXRPd25Qcm9wZXJ0eU5hbWVzKHRoaXMpKSB7XHJcblx0XHRcdHR5cGVvZiB0aGlzW3Byb3BlcnR5XSAhPSAnZnVuY3Rpb24nICYmICh0aGlzW3Byb3BlcnR5XSA9IG51bGwpO1xyXG5cdFx0fVxyXG5cdH07XHJcblxyXG5cdCQuZm4ub3dsQ2Fyb3VzZWwuQ29uc3RydWN0b3IuUGx1Z2lucy5IYXNoID0gSGFzaDtcclxuXHJcbn0pKHdpbmRvdy5aZXB0byB8fCB3aW5kb3cualF1ZXJ5LCB3aW5kb3csIGRvY3VtZW50KTtcclxuXHJcbi8qKlxyXG4gKiBTdXBwb3J0IFBsdWdpblxyXG4gKlxyXG4gKiBAdmVyc2lvbiAyLjMuNFxyXG4gKiBAYXV0aG9yIFZpdmlkIFBsYW5ldCBTb2Z0d2FyZSBHbWJIXHJcbiAqIEBhdXRob3IgQXJ0dXMgS29sYW5vd3NraVxyXG4gKiBAYXV0aG9yIERhdmlkIERldXRzY2hcclxuICogQGxpY2Vuc2UgVGhlIE1JVCBMaWNlbnNlIChNSVQpXHJcbiAqL1xyXG47KGZ1bmN0aW9uKCQsIHdpbmRvdywgZG9jdW1lbnQsIHVuZGVmaW5lZCkge1xyXG5cclxuXHR2YXIgc3R5bGUgPSAkKCc8c3VwcG9ydD4nKS5nZXQoMCkuc3R5bGUsXHJcblx0XHRwcmVmaXhlcyA9ICdXZWJraXQgTW96IE8gbXMnLnNwbGl0KCcgJyksXHJcblx0XHRldmVudHMgPSB7XHJcblx0XHRcdHRyYW5zaXRpb246IHtcclxuXHRcdFx0XHRlbmQ6IHtcclxuXHRcdFx0XHRcdFdlYmtpdFRyYW5zaXRpb246ICd3ZWJraXRUcmFuc2l0aW9uRW5kJyxcclxuXHRcdFx0XHRcdE1velRyYW5zaXRpb246ICd0cmFuc2l0aW9uZW5kJyxcclxuXHRcdFx0XHRcdE9UcmFuc2l0aW9uOiAnb1RyYW5zaXRpb25FbmQnLFxyXG5cdFx0XHRcdFx0dHJhbnNpdGlvbjogJ3RyYW5zaXRpb25lbmQnXHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9LFxyXG5cdFx0XHRhbmltYXRpb246IHtcclxuXHRcdFx0XHRlbmQ6IHtcclxuXHRcdFx0XHRcdFdlYmtpdEFuaW1hdGlvbjogJ3dlYmtpdEFuaW1hdGlvbkVuZCcsXHJcblx0XHRcdFx0XHRNb3pBbmltYXRpb246ICdhbmltYXRpb25lbmQnLFxyXG5cdFx0XHRcdFx0T0FuaW1hdGlvbjogJ29BbmltYXRpb25FbmQnLFxyXG5cdFx0XHRcdFx0YW5pbWF0aW9uOiAnYW5pbWF0aW9uZW5kJ1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fVxyXG5cdFx0fSxcclxuXHRcdHRlc3RzID0ge1xyXG5cdFx0XHRjc3N0cmFuc2Zvcm1zOiBmdW5jdGlvbigpIHtcclxuXHRcdFx0XHRyZXR1cm4gISF0ZXN0KCd0cmFuc2Zvcm0nKTtcclxuXHRcdFx0fSxcclxuXHRcdFx0Y3NzdHJhbnNmb3JtczNkOiBmdW5jdGlvbigpIHtcclxuXHRcdFx0XHRyZXR1cm4gISF0ZXN0KCdwZXJzcGVjdGl2ZScpO1xyXG5cdFx0XHR9LFxyXG5cdFx0XHRjc3N0cmFuc2l0aW9uczogZnVuY3Rpb24oKSB7XHJcblx0XHRcdFx0cmV0dXJuICEhdGVzdCgndHJhbnNpdGlvbicpO1xyXG5cdFx0XHR9LFxyXG5cdFx0XHRjc3NhbmltYXRpb25zOiBmdW5jdGlvbigpIHtcclxuXHRcdFx0XHRyZXR1cm4gISF0ZXN0KCdhbmltYXRpb24nKTtcclxuXHRcdFx0fVxyXG5cdFx0fTtcclxuXHJcblx0ZnVuY3Rpb24gdGVzdChwcm9wZXJ0eSwgcHJlZml4ZWQpIHtcclxuXHRcdHZhciByZXN1bHQgPSBmYWxzZSxcclxuXHRcdFx0dXBwZXIgPSBwcm9wZXJ0eS5jaGFyQXQoMCkudG9VcHBlckNhc2UoKSArIHByb3BlcnR5LnNsaWNlKDEpO1xyXG5cclxuXHRcdCQuZWFjaCgocHJvcGVydHkgKyAnICcgKyBwcmVmaXhlcy5qb2luKHVwcGVyICsgJyAnKSArIHVwcGVyKS5zcGxpdCgnICcpLCBmdW5jdGlvbihpLCBwcm9wZXJ0eSkge1xyXG5cdFx0XHRpZiAoc3R5bGVbcHJvcGVydHldICE9PSB1bmRlZmluZWQpIHtcclxuXHRcdFx0XHRyZXN1bHQgPSBwcmVmaXhlZCA/IHByb3BlcnR5IDogdHJ1ZTtcclxuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XHJcblx0XHRcdH1cclxuXHRcdH0pO1xyXG5cclxuXHRcdHJldHVybiByZXN1bHQ7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBwcmVmaXhlZChwcm9wZXJ0eSkge1xyXG5cdFx0cmV0dXJuIHRlc3QocHJvcGVydHksIHRydWUpO1xyXG5cdH1cclxuXHJcblx0aWYgKHRlc3RzLmNzc3RyYW5zaXRpb25zKCkpIHtcclxuXHRcdC8qIGpzaGludCAtVzA1MyAqL1xyXG5cdFx0JC5zdXBwb3J0LnRyYW5zaXRpb24gPSBuZXcgU3RyaW5nKHByZWZpeGVkKCd0cmFuc2l0aW9uJykpXHJcblx0XHQkLnN1cHBvcnQudHJhbnNpdGlvbi5lbmQgPSBldmVudHMudHJhbnNpdGlvbi5lbmRbICQuc3VwcG9ydC50cmFuc2l0aW9uIF07XHJcblx0fVxyXG5cclxuXHRpZiAodGVzdHMuY3NzYW5pbWF0aW9ucygpKSB7XHJcblx0XHQvKiBqc2hpbnQgLVcwNTMgKi9cclxuXHRcdCQuc3VwcG9ydC5hbmltYXRpb24gPSBuZXcgU3RyaW5nKHByZWZpeGVkKCdhbmltYXRpb24nKSlcclxuXHRcdCQuc3VwcG9ydC5hbmltYXRpb24uZW5kID0gZXZlbnRzLmFuaW1hdGlvbi5lbmRbICQuc3VwcG9ydC5hbmltYXRpb24gXTtcclxuXHR9XHJcblxyXG5cdGlmICh0ZXN0cy5jc3N0cmFuc2Zvcm1zKCkpIHtcclxuXHRcdC8qIGpzaGludCAtVzA1MyAqL1xyXG5cdFx0JC5zdXBwb3J0LnRyYW5zZm9ybSA9IG5ldyBTdHJpbmcocHJlZml4ZWQoJ3RyYW5zZm9ybScpKTtcclxuXHRcdCQuc3VwcG9ydC50cmFuc2Zvcm0zZCA9IHRlc3RzLmNzc3RyYW5zZm9ybXMzZCgpO1xyXG5cdH1cclxuXHJcbn0pKHdpbmRvdy5aZXB0byB8fCB3aW5kb3cualF1ZXJ5LCB3aW5kb3csIGRvY3VtZW50KTsiXSwiZmlsZSI6Im93bGNhcm91c2VsMi9vd2wuY2Fyb3VzZWwuanMifQ==

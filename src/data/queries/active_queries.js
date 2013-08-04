BetaJS.Queries.ActiveQueryEngine = BetaJS.Class.extend("ActiveQueryEngine", {
	
	constructor: function () {
		this._inherited(BetaJS.Queries.ActiveQueryEngine, "constructor");
		this.__aqs = {};
		this.__object_to_aqs = {};
		this.__match_to_aqs = {};
		this.__uniform_aqs = {};
	},
	
	__valid_for_aq: function (raw, aq) {
		return BetaJS.Queries.evaluate(aq.query(), raw);
	},
	
	insert: function (object) {
		if (this.__object_to_aqs[BetaJS.Ids.objectId(object)])
			return;
		var raw = object.getAll();
		var aqs = {};
		this.__object_to_aqs[BetaJS.Ids.objectId(object)] = aqs;
		BetaJS.Objs.iter(this.__uniform_aqs, function (aq) {
			aq._add(object);
			aqs[BetaJS.Ids.objectId(aq)] = aq;
		}, this);
		for (var key in raw) {
			var normalized = key + ":" + JSON.stringify(raw[key]);
			if (this.__match_to_aqs[normalized])
				BetaJS.Objs.iter(this.__match_to_aqs[normalized], function (aq) {
					if (this.__valid_for_aq(raw, aq)) {
						aq._add(object);
						aqs[BetaJS.Ids.objectId(aq)] = aq;
					}
				}, this);
		}
		object.on("change", function () {
			this.update(object);
		}, this);
	},
	
	remove: function (object) {
		BetaJS.Objs.iter(this.__object_to_aqs[BetaJS.Ids.objectId(object)], function (aq) {
			aq._remove(object);
		}, this);
		delete this.__object_to_aqs[BetaJS.Ids.objectId(object)];
		object.off(null, this, null);
	},
	
	update: function (object) {
		var raw = object.getAll();
		var aqs = this.__object_to_aqs[BetaJS.Ids.objectId(object)];
		BetaJS.Objs.iter(this.__object_to_aqs[BetaJS.Ids.objectId(object)], function (aq) {
			if (!this.__valid_for_aq(raw, aq)) {
				aq._remove(object);
				delete aqs[BetaJS.Ids.objectId(aq)];
			}
		}, this);
		for (var key in raw) {
			var normalized = key + ":" + JSON.stringify(raw[key]);
			if (this.__match_to_aqs[normalized])
				BetaJS.Objs.iter(this.__match_to_aqs[normalized], function (aq) {
					if (!(BetaJS.Ids.objectId(aq) in aqs) && this.__valid_for_aq(raw, aq)) {
						aq._add(object);
						aqs[BetaJS.Ids.objectId(aq)] = aq;
					}
				}, this);
		}
	},
	
	register: function (aq) {
		if (aq.isUniform())
			this.__uniform_aqs[BetaJS.Ids.objectId(aq)] = aq
		else
			this.__aqs[BetaJS.Ids.objectId(aq)] = aq;
		var query = aq.query();
		for (var key in query) {
			var normalized = key + ":" + JSON.stringify(query[key]);
			this.__match_to_aqs[normalized] = this.__match_to_aqs[normalized] || {};
			this.__match_to_aqs[normalized][BetaJS.Ids.objectId(aq)] = aq;
		}
		var result = this._query(query);
		while (result.hasNext()) {
			var object = result.next();
			if (this.__object_to_aqs[BetaJS.Ids.objectId(object)]) {
				this.__object_to_aqs[BetaJS.Ids.objectId(object)][BetaJS.Ids.objectId(aq)] = aq;
				aq._add(object);
			} else
				this.insert(object);
		}
	},
	
	unregister: function (aq) {
		if (aq.isUniform())
			delete this.__uniform_aqs[BetaJS.Ids.objectId(aq)]
		else
			delete this.__aqs[BetaJS.Ids.objectId(aq)];
		var self = this;
		aq.collection().iterate(function (object) {
			delete self.__object_to_aqs[BetaJS.Ids.objectId(object)][BetaJS.Ids.objectId(aq)];
		});
		var query = aq.query();
		for (var key in query) {
			var normalized = key + ":" + JSON.stringify(query[key]);
			delete this.__match_to_aqs[normalized][BetaJS.Ids.objectId(aq)];
			if (BetaJS.Types.is_empty(this.__match_to_aqs[normalized]))
				delete this.__match_to_aqs[normalized];
		}		
	},
	
	_query: function (query) {
	},	
	
});

BetaJS.Queries.ActiveQuery = BetaJS.Class.extend("ActiveQuery", {
	
	constructor: function (engine, query) {
		this._inherited(BetaJS.Queries.ActiveQuery, "constructor");
		this.__engine = engine;
		this.__query = query;
		this.__collection = new BetaJS.Collections.Collection();
		engine.register(this);
	},
	
	destroy: function () {
		this.__engine.unregister(this);
		this._inherited(BetaJS.Queries.ActiveQuery, "destroy");
	},
	
	isUniform: function () {
		return BetaJS.Types.is_empty(this.query());
	},
	
	engine: function () {
		return this.__engine;
	},
	
	query: function () {
		return this.__query;
	},
	
	collection: function () {
		return this.__collection;
	},
	
	_add: function (object) {
		this.__collection.add(object);		
	},
	
	_remove: function (object) {
		this.__collection.remove(object);
	},
	
	change_query: function (query) {
		this.__engine.unregister(this);
		this.__query = query;
		this.__collection.clear();
		this.__engine.register(this);
	}
	
});

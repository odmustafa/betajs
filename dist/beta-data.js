/*!
  betajs - v0.0.1 - 2013-08-03
  Copyright (c) Oliver Friedmann & Victor Lingenthal
  MIT Software License.
*/
BetaJS.Net = {};


/*
 * <ul>
 *  <li>uri: target uri</li>
 *  <li>method: get, post, ...</li>
 *  <li>data: data as JSON to be passed with the request</li>
 *  <li>success_callback(data): will be called when request was successful</li>
 *  <li>failure_callback(status_code, status_text, data): will be called when request was not successful</li>
 *  <li>complete_callback(): will be called when the request has been made</li>
 * </ul>
 * 
 */
BetaJS.Net.AbstractAjax = BetaJS.Class.extend("AbstractAjax", {
	
	constructor: function (options) {
		this._inherited(BetaJS.Net.AbstractAjax, "constructor");
		this.__options = BetaJS.Objs.extend({
			"method": "GET",
			"data": {}
		}, options);
	},
	
	syncCall: function (options) {
		var opts = BetaJS.Objs.clone(this.__options, 1);
		opts = BetaJS.Objs.extend(opts, options);
		var success_callback = opts.success_callback;
		delete opts["success_callback"];
		var failure_callback = opts.failure_callback;
		delete opts["failure_callback"];
		var complete_callback = opts.complete_callback;
		delete opts["complete_callback"];
		try {
			var result = this._syncCall(opts);
			if (success_callback)
				success_callback(result);
			if (complete_callback)
				complete_callback();
			return result;
		} catch (e) {
			e = BetaJS.Exceptions.ensure(e);
			e.assert(BetaJS.Net.AjaxException);
			if (failure_callback)
				failure_callback(e.status_code(), e.status_text(), e.data())
			else
				throw e;
		}
	},
	
	asyncCall: function (options) {
		var opts = BetaJS.Objs.clone(this.__options, 1);
		opts = BetaJS.Objs.extend(opts, options);
		var success_callback = opts.success_callback;
		delete opts["success_callback"];
		var failure_callback = opts.failure_callback;
		delete opts["failure_callback"];
		var complete_callback = opts.complete_callback;
		delete opts["complete_callback"];
		try {
			var result = this._asyncCall(BetaJS.Objs.extend({
				"success": function (data) {
					if (success_callback)
						success_callback(data);
					if (complete_callback)
						complete_callback();
				},
				"failure": function (status_code, status_text, data) {
					if (failure_callback)
						failure_callback(status_code, status_text, data)
					else
						throw new BetaJS.Net.AjaxException(status_code, status_text, data);
					if (complete_callback)
						complete_callback();
				}
			}, opts));
			return result;
		} catch (e) {
			e = BetaJS.Exceptions.ensure(e);
			e.assert(BetaJS.Net.AjaxException);
			if (failure_callback)
				failure_callback(e.status_code(), e.status_text(), e.data())
			else
				throw e;
		}
	},
	
	call: function (options) {
		if (!("async" in options))
			return false;
		var async = options["async"];
		delete options["async"];
		return async ? this.asyncCall(options) : this.syncCall(options);
	},
	
	_syncCall: function (options) {},
	
	_asyncCall: function (options) {},
	
});


BetaJS.Net.AjaxException = BetaJS.Exceptions.Exception.extend("AjaxException", {
	
	constructor: function (status_code, status_text, data) {
		this._inherited(BetaJS.Net.AjaxException, "constructor", status_code + ": " + status_text);
		this.__status_code = status_code;
		this.__status_text = status_text;
		this.__data = data;
	},
	
	status_code: function () {
		return this.__status_code;
	},
	
	status_text: function () {
		return this.__status_text;
	},
	
	data: function () {
		return this.__data;
	}
	
});


BetaJS.Net.JQueryAjax = BetaJS.Net.AbstractAjax.extend("JQueryAjax", {
	
	_syncCall: function (options) {
		var result;
		BetaJS.$.ajax({
			type: options.method,
			async: false,
			url: options.uri,
//			dataType: "json", 
			data: JSON.stringify(options.data), //options.data
			success: function (response) {
				result = response;
			},
			error: function (jqXHR, textStatus, errorThrown) {
				throw new BetaJS.Net.AjaxException(errorThrown, textStatus, jqXHR);
			}
		});
		return result;
	},
	
	_asyncCall: function (options) {
		BetaJS.$.ajax({
			type: options.method,
			async: true,
			url: options.uri,
//			dataType: "json", 
			data: JSON.stringify(options.data), //options.data
			success: function (response) {
				options.success(response);
			},
			error: function (jqXHR, textStatus, errorThrown) {
				options.failure(errorThrown, textStatus, jqXHR);
			}
		});
	},

});

BetaJS.Queries = {

	/*
	 * Syntax:
	 *
	 * query :== Object | ["Or", query, query, ...] | ["And", query, query, ...] |
	 *           [("=="|"!="|>"|">="|"<"|"<="), key, value]
	 *
	 */

	__dependencies : function(query, dep) {
		if (BetaJS.Types.is_array(query)) {
			if (query.length == 0)
				throw "Malformed Query";
			var op = query[0];
			if (op == "Or" || op == "And") {
				for (var i = 1; i < query.length; ++i)
					dep = this.__dependencies(query[i], dep);
				return dep;
			} else {
				if (query.length != 3)
					throw "Malformed Query";
				var key = query[1];
				if ( key in dep)
					dep[key]++
				else
					dep[key] = 1;
				return dep;
			}
		} else if (BetaJS.Types.is_object(query)) {
			for (key in query)
			if ( key in dep)
				dep[key]++
			else
				dep[key] = 1;
			return dep;
		} else
			throw "Malformed Query";
	},

	dependencies : function(query) {
		return this.__dependencies(query, {});
	},
	
	format: function (query) {
		if (BetaJS.Class.is_class_instance(query))
			return query.format();
		return JSON.stringify(query);
	},
	
	overloaded_evaluate: function (query, object) {
		if (BetaJS.Class.is_class_instance(query))
			return query.evaluate(object);
		if (BetaJS.Types.is_function(query))
			return query(object);
		return this.evaluate(query, object);
	},
	
	evaluate : function(query, object) {
		if (object == null)
			return false;
		if (BetaJS.Types.is_array(query)) {
			if (query.length == 0)
				throw "Malformed Query";
			var op = query[0];
			if (op == "Or") {
				for (var i = 1; i < query.length; ++i)
					if (this.evaluate(query[i], object))
						return true;
				return false;
			} else if (op == "And") {
				for (var i = 1; i < query.length; ++i)
					if (!this.evaluate(query[i], object))
						return false;
				return true;
			} else {
				if (query.length != 3)
					throw "Malformed Query";
				var key = query[1];
				var obj_value = object[key];
				var value = query[2];
				if (op == "==")
					return obj_value == value
				else if (op == "!=")
					return obj_value != value
				else if (op == ">")
					return obj_value > value
				else if (op == ">=")
					return obj_value >= value
				else if (op == "<")
					return obj_value < value
				else if (op == "<=")
					return obj_value <= value
				else
					throw "Malformed Query";
			}
		} else if (BetaJS.Types.is_object(query)) {
			for (key in query)
				if (query[key] != object[key])
					return false;
			return true;
		} else
			throw "Malformed Query";
	},

	__compile : function(query) {
		if (BetaJS.Types.is_array(query)) {
			if (query.length == 0)
				throw "Malformed Query";
			var op = query[0];
			if (op == "Or") {
				var s = "false";
				for (var i = 1; i < query.length; ++i)
					s += " || (" + this.__compile(query[i]) + ")";
				return s;
			} else if (op == "And") {
				var s = "true";
				for (var i = 1; i < query.length; ++i)
					s += " && (" + this.__compile(query[i]) + ")";
				return s;
			} else {
				if (query.length != 3)
					throw "Malformed Query";
				var key = query[1];
				var value = query[2];
				var left = "object['" + key + "']";
				var right = BetaJS.Types.is_string(value) ? "'" + value + "'" : value;
				return left + " " + op + " " + right;
			}
		} else if (BetaJS.Types.is_object(query)) {
			var s = "true";
			for (key in query)
				s += " && (object['" + key + "'] == " + (BetaJS.Types.is_string(query[key]) ? "'" + query[key] + "'" : query[key]) + ")";
			return s;
		} else
			throw "Malformed Query";
	},

	compile : function(query) {
		var result = this.__compile(query);
		var func = new Function('object', result);
		var func_call = function(data) {
			return func.call(this, data);
		};
		func_call.source = 'function(object){\n return ' + result + '; }';
		return func_call;		
	},
	
	emulate: function (query, query_function, query_context) {
		var raw = query_function.apply(query_context || this, {});
		var iter = raw;
		if (raw == null)
			iter = BetaJS.Iterators.ArrayIterator([])
		else if (BetaJS.Types.is_array(raw))
			iter = BetaJS.Iterators.ArrayIterator(raw);		
		return new BetaJS.Iterators.FilteredIterator(iter, function(row) {
			return BetaJS.Queries.evaluate(query, row);
		});
	}	
	
}; 
BetaJS.Queries.CompiledQuery = BetaJS.Class.extend("CompiledQuery", {
	
	constructor: function (query) {
		this.__query = query;
		this.__dependencies = BetaJS.Query.dependencies(query);
		this.__compiled = BetaJS.Query.compile(query);
	},
	
	query: function () {
		return this.__query;
	},
	
	dependencies: function () {
		return this.__dependencies;
	},
	
	compiled: function () {
		return this.__compiled;
	},
	
	evaluate: function (object) {
		return this.__compiled(object);
	},
	
	format: function () {
		return BetaJS.Query.format(this.__query);
	}
	
});

BetaJS.Queries.Constrained = {
	
	make: function (query, options) {
		return {
			query: query,
			options: options || {}
		};
	},
	
	format: function (instance) {
		var query = instance.query;
		instance.query = BetaJS.Queries.format(query);
		var result = JSON.stringify(instance);
		instance.query = query;
		return result;
	},
	
	emulate: function (constrained_query, query_capabilities, query_function, query_context) {
		var query = constrained_query.query;
		var options = constrained_query.options;
		var execute_query = {};
		var execute_options = {};
		if ("sort" in options && "sort" in query_capabilities)
			execute_options.sort = options.sort;
		// Test
		execute_query = query;
		if ("query" in query_capabilities || BetaJS.Types.is_empty(query)) {
			execute_query = query;
			if (!("sort" in options) || "sort" in query_capabilities) {
				if ("skip" in options && "skip" in query_capabilities)
					execute_options.skip = options.skip;
				if ("limit" in options && "limit" in query_capabilities)
					execute_options.limit = options.limit;
			}
		}
		var raw = query_function.apply(query_context || this, [execute_query, execute_options]);
		var iter = raw;
		if (raw == null)
			iter = new BetaJS.Iterators.ArrayIterator([])
		else if (BetaJS.Types.is_array(raw))
			iter = new BetaJS.Iterators.ArrayIterator(raw);		
		if (!("query" in query_capabilities || BetaJS.Types.is_empty(query)))
			iter = new BetaJS.Iterators.FilteredIterator(iter, function(row) {
				return BetaJS.Queries.evaluate(query, row);
			});
		if ("sort" in options && !("sort" in execute_options))
			iter = new BetaJS.Iterators.SortedIterator(iter, BetaJS.Comparators.byObject(options.sort));
		if ("skip" in options && !("skip" in execute_options))
			iter = new BetaJS.Iterators.SkipIterator(iter, options["skip"]);
		if ("limit" in options && !("limit" in execute_options))
			iter = new BetaJS.Iterators.LimitIterator(iter, options["limit"]);
		return iter;
	}
	
	

}; 

BetaJS.Collections.QueryCollection = BetaJS.Collections.Collection.extend("QueryCollection", {
	
	constructor: function (options) {
		this._inherited(BetaJS.Collections.QueryCollection, "constructor", options);
		this.__query = BetaJS.Objs.extend({
			func: null,
			select: {},
			skip: 0,
			limit: null,
			forward_steps: null,
			backward_steps: null,
			range: null,
			count: null,
			sort: {}
		}, options.query);
		if (!("objects" in options))
			options.objects = this.__execute_query(this.__query.skip, this.__query.limit, true);
	},
	
	__execute_query: function (skip, limit, clear_before) {
		skip = Math.max(skip, 0);
		var q = {};
		if (this.__query.sort != null && !BetaJS.Types.is_empty(this.__query.sort))
			q.sort = this.__query.sort;
		if (clear_before) {
			if (skip > 0)
				q.skip = skip;
			if (limit != null)
				q.limit = limit;
			var iter = this.__query.func(this.__query.select, q);
			var objs = iter.asArray();
			this.__query.skip = skip;
			this.__query.limit = limit;
			this.__query.count = limit == null || objs.length < limit ? skip + objs.length : null;
			this.clear();
			this.add_objects(objs);
		} else if (skip < this.__query.skip) {
			limit = this.__query.skip - skip;
			if (skip > 0)
				q.skip = skip;
			q.limit = limit;
			var iter = this.__query.func(this.__query.select, q);
			var objs = iter.asArray();
			this.__query.skip = skip;
			this.__query.limit = this.__query.limit == null ? null : this.__query.limit + objs.length;
			this.add_objects(objs);
		} else if (skip >= this.__query.skip) {
			if (this.__query.limit != null && (limit == null || skip + limit > this.__query.skip + this.__query.limit)) {
				limit = (skip + limit) - (this.__query.skip + this.__query.limit);
				skip = this.__query.skip + this.__query.limit;
				if (skip > 0)
					q.skip = skip;
				if (limit != null)
					q.limit = limit;
				var iter = this.__query.func(this.__query.select, q);
				var objs = iter.asArray();
				this.__query.limit = this.__query.limit + objs.length;
				if (limit > objs.length)
					this.__query.count = skip + objs.length;
				this.add_objects(objs);
			}
		}
	},
	
	increase_forwards: function (steps) {
		steps = steps == null ? this.__query.forward_steps : steps;
		if (steps == null || this.__query.limit == null)
			return;
		this.__execute_query(this.__query.skip + this.__query.limit, steps, false);
	},
	
	increase_backwards: function (steps) {
		steps = steps == null ? this.__query.backward_steps : steps;
		if (steps != null && this.__query.skip > 0) {
			var steps = Math.min(steps, this.__query.skip)
			this.__execute_query(this.__query.skip - steps, steps, false);
		}
	},
	
	paginate: function (index) {
		this.__execute_query(this.__query.range * index, this.__query.range, true);
	},
	
	paginate_index: function () {
		return this.__query.range == null ? null : Math.floor(this.__query.skip / this.__query.range);
	},
	
	paginate_count: function () {
		return this.__query.count == null || this.__query.range == null ? null : Math.ceil(this.__query.count / this.__query.range);
	},
	
	next: function () {
		var paginate_index = this.paginate_index();
		if (paginate_index == null)
			return;
		var paginate_count = this.paginate_count();
		if (paginate_count == null || paginate_index < this.paginate_count() - 1)
			this.paginate(paginate_index + 1);
	},
	
	prev: function () {
		var paginate_index = this.paginate_index();
		if (paginate_index == null)
			return;
		if (paginate_index > 0)
			this.paginate(paginate_index - 1);
	},
	
	isComplete: function () {
		return this.__query.count != null;
	}
	
});
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

BetaJS.Stores = BetaJS.Stores || {};


BetaJS.Stores.StoreException = BetaJS.Exceptions.Exception.extend("StoreException");


/** @class */
BetaJS.Stores.BaseStore = BetaJS.Class.extend("BaseStore", [
	BetaJS.Events.EventsMixin,
	/** @lends BetaJS.Stores.BaseStore.prototype */
	{
		
	constructor: function (options) {
		this._inherited(BetaJS.Stores.BaseStore, "constructor");
		options = options || {};
		this._id_key = options.id_key || "id";
		this._create_ids = options.create_ids || false;
		this._last_id = 1;
	},
			
	/** Insert data to store. Return inserted data with id.
	 * 
 	 * @param data data to be inserted
 	 * @return data that has been inserted with id.
	 */
	_insert: function (data) {
	},
	
	/** Remove data from store. Return removed data.
	 * 
 	 * @param id data id
 	 * @return data
	 */
	_remove: function (id) {
	},
	
	/** Get data from store by id.
	 * 
	 * @param id data id
	 * @return data
	 */
	_get: function (id) {
	},
	
	/** Update data by id.
	 * 
	 * @param id data id
	 * @param data updated data
	 * @return data from store
	 */
	_update: function (id, data) {
	},
	
	_query_capabilities: function () {
		return {};
	},
	
	_query: function (query, options) {
	},	
	
	insert: function (data) {
		if (this._create_ids) {
			if (this._id_key in data) {
				if (this.get(data[this._id_key]))
					return null;
			} else {
				while (this.get(this._last_id))
					this._last_id++;
				data[this._id_key] = this._last_id;
			}
		}
		var row = this._insert(data);
		if (row)
			this.trigger("insert", row)
		return row;
	},
	
	remove: function (id) {
		var row = this._remove(id);
		if (row)
			this.trigger("remove", id);
		return row;
	},
	
	get: function (id) {
		return this._get(id);
	},
	
	update: function (id, data) {
		var row = this._update(id, data);
		if (row)
			this.trigger("update", row, data);
		return row;
	},
	
	query: function (query, options) {
		return BetaJS.Queries.Constrained.emulate(
			BetaJS.Queries.Constrained.make(query || {}, options || {}),
			this._query_capabilities(),
			this._query,
			this
		); 
	},
	
	_query_applies_to_id: function (query, id) {
		var row = this.get(id);
		return row && BetaJS.Queries.overloaded_evaluate(query, row);
	},
	
	clear: function () {
		var iter = this.query({});
		while (iter.hasNext())
			this.remove(iter.next().id);
	}

}]);

BetaJS.Stores.AssocStore = BetaJS.Stores.BaseStore.extend("AssocStore", {
	
	_read_key: function (key) {},
	_write_key: function (key, value) {},
	_remove_key: function (key) {},
	_iterate: function () {},
	
	constructor: function (options) {
		options = options || {};
		options.create_ids = true;
		this._inherited(BetaJS.Stores.AssocStore, "constructor", options);
	},
	
	_insert: function (data) {
		this._write_key(data[this._id_key], data);
		return data;
	},
	
	_remove: function (id) {
		var row = this._read_key(id);
		if (row && !this._remove_key(id))
			return null;
		return row;
	},
	
	_get: function (id) {
		return this._read_key(id);
	},
	
	_update: function (id, data) {
		var row = this._get(id);
		if (row) {
			delete data[this._id_key];
			BetaJS.Objs.extend(row, data);
			this._write_key(id, row);
		}
		return row;
	},
	
	_query: function (query, options) {
		return this._iterate();
	},	

});

BetaJS.Stores.MemoryStore = BetaJS.Stores.AssocStore.extend("MemoryStore", {
	
	constructor: function (options) {
		this._inherited(BetaJS.Stores.MemoryStore, "constructor", options);
		this.__data = {};
	},

	_read_key: function (key) {
		return this.__data[key];
	},
	
	_write_key: function (key, value) {
		this.__data[key] = value;
	},
	
	_remove_key: function (key) {
		delete this.__data[key];
	},
	
	_iterate: function () {
		return new BetaJS.Iterators.ObjectValuesIterator(this.__data);
	}
	
});

BetaJS.Stores.DumbStore = BetaJS.Stores.BaseStore.extend("DumbStore", {
	
	_read_last_id: function () {},
	_write_last_id: function (id) {},
	_remove_last_id: function () {},
	_read_first_id: function () {},
	_write_first_id: function (id) {},
	_remove_first_id: function () {},
	_read_item: function (id) {},
	_write_item: function (id, data) {},
	_remove_item: function (id) {},
	_read_next_id: function (id) {},
	_write_next_id: function (id, next_id) {},
	_remove_next_id: function (id) {},
	_read_prev_id: function (id) {},
	_write_prev_id: function (id, prev_id) {},
	_remove_prev_id: function (id) {},
	
	constructor: function (options) {
		options = options || {};
		options.create_ids = true;
		this._inherited(BetaJS.Stores.DumbStore, "constructor", options);
	},

	_insert: function (data) {
		var last_id = this._read_last_id();
		var id = data[this._id_key];
		if (last_id != null) {
			this._write_next_id(last_id, id);
			this._write_prev_id(id, last_id);
		} else
			this._write_first_id(id);
		this._write_last_id(id);
		this._write_item(id, data);
		return data;
	},
	
	_remove: function (id) {
		var row = this._read_item(id);
		if (row) {
			this._remove_item(id);
			var next_id = this._read_next_id(id);
			var prev_id = this._read_prev_id(id);
			if (next_id != null) {
				this._remove_next_id(id);
				if (prev_id != null) {
					this._remove_prev_id(id);
					this._write_next_id(prev_id, next_id);
					this._write_prev_id(next_id, prev_id);
				} else {
					this._remove_prev_id(next_id);
					this._write_first_id(next_id);
				}
			} else if (prev_id != null) {
				this._remove_next_id(prev_id);
				this._write_last_id(prev_id);
			} else {
				this._remove_first_id();
				this._remove_last_id();
			}
		}
		return row;
	},
	
	_get: function (id) {
		return this._read_item(id);
	},
	
	_update: function (id, data) {
		var row = this._get(id);
		if (row) {
			delete data[this._id_key];
			BetaJS.Objs.extend(row, data);
			this._write_item(id, row);
		}
		return row;
	},
	
	_query_capabilities: function () {
		return {
			query: true
		};
	},

	_query: function (query, options) {
		var iter = new BetaJS.Iterators.Iterator();
		var store = this;
		var fid = this._read_first_id();
		BetaJS.Objs.extend(iter, {
			__id: fid == null ? 1 : fid,
			__store: store,
			__query: query,
			
			hasNext: function () {
				var last_id = this.__store._read_last_id();
				if (last_id == null)
					return false;
				while (this.__id < last_id && !this.__store._read_item(this.__id))
					this.__id++;
				while (this.__id <= last_id) {
					if (this.__store._query_applies_to_id(query, this.__id))
						return true;
					if (this.__id < last_id)
						this.__id = this.__store._read_next_id(this.__id)
					else
						this.__id++;
				}
				return false;
			},
			
			next: function () {
				if (this.hasNext()) {
					var item = this.__store.get(this.__id);
					if (this.__id == this.__store._read_last_id())
						this.__id++
					else
						this.__id = this.__store._read_next_id(this.__id);
					return item;
				}
				return null;
			}
		});
		return iter;
	},	
	
	
});

BetaJS.Stores.AssocDumbStore = BetaJS.Stores.DumbStore.extend("AssocDumbStore", {
	
	_read_key: function (key) {},
	_write_key: function (key, value) {},
	_remove_key: function (key) {},
	
	__read_id: function (key) {
		var raw = this._read_key(key);
		return raw ? parseInt(raw) : null;
	},
	
	_read_last_id: function () {
		return this.__read_id("last_id");
	},
	
	_write_last_id: function (id) {
		this._write_key("last_id", id);
	},

	_remove_last_id: function () {
		this._remove_key("last_id");
	},

	_read_first_id: function () {
		return this.__read_id("first_id");
	},
	
	_write_first_id: function (id) {
		this._write_key("first_id", id);
	},
	
	_remove_first_id: function () {
		this._remove_key("first_id");
	},

	_read_item: function (id) {
		return this._read_key("item_" + id);
	},

	_write_item: function (id, data) {
		this._write_key("item_" + id, data);
	},
	
	_remove_item: function (id) {
		this._remove_key("item_" + id);
	},
	
	_read_next_id: function (id) {
		return this.__read_id("next_" + id);
	},

	_write_next_id: function (id, next_id) {
		this._write_key("next_" + id, next_id);
	},
	
	_remove_next_id: function (id) {
		this._remove_key("next_" + id);
	},
	
	_read_prev_id: function (id) {
		return this.__read_id("prev_" + id);
	},

	_write_prev_id: function (id, prev_id) {
		this._write_key("prev_" + id, prev_id);
	},

	_remove_prev_id: function (id) {
		this._remove_key("prev_" + id);
	}
	
});

BetaJS.Stores.LocalStore = BetaJS.Stores.AssocDumbStore.extend("LocalStore", {
	
	constructor: function (options) {
		this._inherited(BetaJS.Stores.LocalStore, "constructor", options);
		this.__prefix = options.prefix;
	},
	
	__key: function (key) {
		return this.__prefix + key;
	},
	
	_read_key: function (key) {
		var prfkey = this.__key(key);
		return prfkey in localStorage ? JSON.parse(localStorage[prfkey]) : null;
	},
	
	_write_key: function (key, value) {
		localStorage[this.__key(key)] = JSON.stringify(value);
	},
	
	_remove_key: function (key) {
		delete localStorage[this.__key(key)];
	},
	
});

BetaJS.Stores.QueryCachedStore = BetaJS.Stores.BaseStore.extend("QueryCachedStore", {

	constructor: function (parent, options) {
		options = options || {};
		options.id_key = parent._id_key;
		this._inherited(BetaJS.Stores.QueryCachedStore, "constructor", options);
		this.__parent = parent;
		this.__cache = {};
		this.__queries = {};
	},
	
	invalidate: function () {
		this.__cache = {};
		this.__queries = {};
	},

	_insert: function (data) {
		var result = this.__parent.insert(data);
		if (result)
			this.__cache[data[this._id_key]] = data;
		return result;
	},
	
	_remove: function (id) {
		var result = this.__parent.remove(id);
		if (result)
			delete this.__cache[id];
		return result;
	},
	
	_update: function (id, data) {
		var result = this.__parent.update(id, data);
		if (result)
			this.__cache[id] = BetaJS.Objs.extend(this.__cache[id], data);
		return result;
	},
	
	_get: function (id) {
		if (!(id in this.__cache))
			this.__cache[id] = this.__parent.get(id);
		return this.__cache[id];
	},
	
	_query_capabilities: function () {
		return this.__parent._query_capabilities();
	},

	_query: function (query, options) {
		var constrained = BetaJS.Queries.Constrained.make(query, options);
		var encoded = BetaJS.Queries.Constrained.format(constrained);
		if (encoded in this.__queries)
			return new BetaJS.Iterators.ArrayIterator(BetaJS.Objs.values(this.__queries[encoded]));
		var result = this.__parent.query(query, options).asArray();
		this.__queries[encoded] = {};
		for (var i = 0; i < result.length; ++i)
			this.__cache_row(result[i], encoded);
		return new BetaJS.Iterators.ArrayIterator(result);
	},
	
	cache: function (query, options, result) {
		var constrained = BetaJS.Queries.Constrained.make(query, options);
		var encoded = BetaJS.Queries.Constrained.format(constrained);
		this.__queries[encoded] = {};
		for (var i = 0; i < result.length; ++i)
			this.__cache_row(result[i], encoded);
	},
	
	__cache_row: function (row, encoded) {
		this.trigger("cache", row);
		this.__cache[row[this._id_key]] = row;
		this.__queries[encoded][row[this._id_key]] = row;
	}
	
});

BetaJS.Stores.FullyCachedStore = BetaJS.Stores.BaseStore.extend("FullyCachedStore", {

	constructor: function (parent, full_data, options) {
		options = options || {};
		options.id_key = parent._id_key;
		this._inherited(BetaJS.Stores.FullyCachedStore, "constructor", options);
		this.__parent = parent;
		this.__cache = {};
		this.__cached = false;
		if (full_data)
			this.invalidate(full_data);
	},
	
	invalidate: function (full_data) {
		this.__cache = {};
		if (!full_data)
			full_data = this.__parent.query({});
		if (BetaJS.Types.is_array(full_data))
			full_data = new BetaJS.Iterators.ArrayIterator(full_data);
		while (full_data.hasNext()) {
			var row = full_data.next();
			this.cache(row);
		}
		this.__cached = true;
	},
	
	cache: function (row) {
		this.trigger("cache", row);		
		this.__cache[row[this._id_key]] = row;
	},
	
	_insert: function (data) {
		if (!this.__cached)
			this.invalidate({});
		var result = this.__parent.insert(data);
		if (result)
			this.__cache[data[this._id_key]] = data;
		return result;
	},
	
	_remove: function (id) {
		if (!this.__cached)
			this.invalidate({});
		var result = this.__parent.remove(id);
		if (result)
			delete this.__cache[id];
		return result;
	},
	
	_get: function (id) {
		if (!this.__cached)
			this.invalidate({});
		return this.__cache[id];
	},
	
	_update: function (id, data) {
		if (!this.__cached)
			this.invalidate({});
		var result = this.__parent.update(id, data);
		if (result)
			this.__cache[id] = BetaJS.Objs.extend(this.__cache[id], data);
		return result;
	},
	
	_query: function (query, options) {
		if (!this.__cached)
			this.invalidate();
		return new BetaJS.Iterators.ArrayIterator(BetaJS.Objs.values(this.__cache));
	},	
	
});

BetaJS.Stores.RemoteStore = BetaJS.Stores.BaseStore.extend("RemoteStore", {

	constructor : function(uri, ajax, options) {
		this._inherited(BetaJS.Stores.RemoteStore, "constructor", options);
		this._uri = uri;
		this.__ajax = ajax;
		this.__options = BetaJS.Objs.extend({
			"update_method": "PUT",
			"uri_mappings": {}
		}, options || {});
	},
	
	getUri: function () {
		return this._uri;
	},
	
	prepare_uri: function (action, data) {
		if (this.__options["uri_mappings"][action])
			return this.__options["uri_mappings"][action](data);
		if (action == "remove" || action == "get" || action == "update")
			return this.getUri() + "/" + data[this._id_key];
		return this.getUri();
	},

	_insert : function(data) {
		try {
			return this.__ajax.syncCall({method: "POST", uri: this.prepare_uri("insert", data), data: data});
		} catch (e) {
			throw new BetaJS.Stores.StoreException(BetaJS.Net.AjaxException.ensure(e).toString()); 			
		}
	},

	_remove : function(id) {
		try {
			var response = this.__ajax.syncCall({method: "DELETE", uri: this.prepare_uri("remove", data)});
			if (response)
				return response;
			response = {};
			response[this._id_key] = id;
			return response;
		} catch (e) {
			throw new BetaJS.Stores.StoreException(BetaJS.Net.AjaxException.ensure(e).toString()); 			
		}
	},

	_get : function(id) {
		var data = {};
		data[this._id_key] = id;
		try {
			return this.__ajax.syncCall({uri: this.prepare_uri("get", data)});
		} catch (e) {
			throw new BetaJS.Stores.StoreException(BetaJS.Net.AjaxException.ensure(e).toString()); 			
		}
	},

	_update : function(id, data) {
		var copy = BetaJS.Objs.clone(data, 1);
		copy[this._id_key] = id;
		try {
			return this.__ajax.syncCall({method: this.__options.update_method, uri: this.prepare_uri("update", copy), data: data});
		} catch (e) {
			throw new BetaJS.Stores.StoreException(BetaJS.Net.AjaxException.ensure(e).toString()); 			
		}
	},
	
	_query : function(query, options) {
		try {		
			var raw = this.__ajax.syncCall(this._encode_query(query, options));
			if (BetaJS.Types.is_string(raw))	
				return JSON.parse(raw)
			else
				return raw;
		} catch (e) {
			throw new BetaJS.Stores.StoreException(BetaJS.Net.AjaxException.ensure(e).toString()); 			
		}
	},
	
	_encode_query: function (query, options) {
		return {
			uri: this.prepare_uri("query")
		};		
	}
	
});


BetaJS.Stores.QueryGetParamsRemoteStore = BetaJS.Stores.RemoteStore.extend("QueryGetParamsRemoteStore", {

	constructor : function(uri, ajax, capability_params, options) {
		this._inherited(BetaJS.Stores.QueryGetParamsRemoteStore, "constructor", uri, ajax, options);
		this.__capability_params = capability_params;
	},
	
	_query_capabilities: function () {
		var caps = {};
		if ("skip" in this.__capability_params)
			caps.skip = true;
		if ("limit" in this.__capability_params)
			caps.limit = true;
		return caps;
	},

	_encode_query: function (query, options) {
		options = options || {};
		var uri = this.getUri() + "?"; 
		if (options["skip"] && "skip" in this.__capability_params)
			uri += this.__capability_params["skip"] + "=" + options["skip"] + "&";
		if (options["limit"] && "limit" in this.__capability_params)
			uri += this.__capability_params["limit"] + "=" + options["limit"] + "&";
		return {
			uri: uri
		};		
	}

});
BetaJS.Stores.ConversionStore = BetaJS.Stores.BaseStore.extend("ConversionStore", {
	
	constructor: function (store, options) {
		options = options || {};
		options.id_key = store._id_key;
		this._inherited(BetaJS.Stores.ConversionStore, "constructor", options);
		this.__store = store;
		this.__key_encoding = options["key_encoding"] || {};
		this.__key_decoding = options["key_decoding"] || {};
		this.__value_encoding = options["value_encoding"] || {};
		this.__value_decoding = options["value_decoding"] || {};
	},
	
	encode_object: function (obj) {
		var result = {};
		for (var key in obj)
			result[this.encode_key(key)] = this.encode_value(key, obj[key]);
		return result;
	},
	
	decode_object: function (obj) {
		var result = {};
		for (var key in obj)
			result[this.decode_key(key)] = this.decode_value(key, obj[key]);
		return result;
	},
	
	encode_key: function (key) {
		return key in this.__key_encoding ? this.__key_encoding[key] : key;
	},
	
	decode_key: function (key) {
		return key in this.__key_decoding ? this.__key_decoding[key] : key;
	},
	
	encode_value: function (key, value) {
		return key in this.__value_encoding ? this.__value_encoding[key](value) : value;
	},
	
	decode_value: function (key, value) {
		return key in this.__value_decoding ? this.__value_decoding[key](value) : value;
	},	

	_insert: function (data) {
		return this.decode_object(this.__store.insert(this.encode_object(data)));
	},
	
	_remove: function (id) {
		return this.__store.remove(this.encode_value(this._id_key, id));
	},

	_get: function (id) {
		return this.decode_object(this.__store.get(this.encode_value(this._id_key, id)));
	},
	
	_update: function (id, data) {
		return this.decode_object(this.__store.update(this.encode_value(this._id_key, id), this.encode_object(data)));
	},
	
	_query_capabilities: function () {
		return this.__store._query_capabilities();
	},
	
	_query: function (query, options) {
		var self = this;
		var result = this.__store.query(this.encode_object(query), options);
		return new BetaJS.Iterators.MappedIterator(result, function (row) {
			return self.decode_object(row);
		});
	}

});

BetaJS.Stores.IndexedStore = BetaJS.Stores.BaseStore.extend("IndexedStore", {
	
	constructor: function (store, indices, options) {
		options = options || {};
		options.rebuild = "rebuild" in options ? options.rebuild : true;
		options.id_key = store._id_key;
		this._inherited(BetaJS.Stores.IndexedStore, "constructor", options);
		this._store = store;
		this._indices = {};
		BetaJS.Objs.iter(indices || {}, function (value, key) {
			value.type = value.type || "StoreIndex";
			this._indices[key] = new BetaJS.Stores[value.type](store, key);
			if (options.rebuild)
				this._indices[key].rebuild();
		}, this);
	},
	
	rebuild: function () {
		BetaJS.Objs.iter(this._indices, function (index) {
			index.rebuild();
		}, this);
	},
	
	_query: function (query, options) {
		var initialized = false;
		var ids = {};
		for (var key in query) 
			if (key in this._indices) {
				if (initialized) {
					var new_ids = this._indices[key].get(query[key]);
					ids = BetaJS.Objs.intersect(ids, new_ids);
				} else {
					initialized = true;
					ids = this._indices[key].get(query[key]);
				}
				if (BetaJS.Types.is_empty(ids))
					return {};
			}
		if (!initialized)
			return this._store.query(query, options);
		var self = this;
		return new BetaJS.Iterators.MappedIterator(
			       new BetaJS.Iterators.FilteredIterator(
			           new BetaJS.Iterators.ObjectKeysIterator(ids),
			           function (id) {
			           	   return self._query_applies_to_id(query, id);
			           }
			       ),
			       function (id) {
                       return self.get(id);
			       }
			 );
	},
	
	_insert: function (data) {
		return this._store.insert(data);
	},

	_remove: function (id) {
		return this._store.remove(id);
	},
	
	_get: function (id) {
		return this._store.get(id);
	},
	
	_update: function (id, data) {
		return this._store.update(id, data);
	},
		
});

BetaJS.Stores.StoreIndex = BetaJS.Class.extend("StoreIndex", {
	
	constructor: function (base_store, index_key) {
		this._inherited(BetaJS.Stores.StoreIndex, "constructor");
		this._base_store = base_store;
		this._index_key = index_key;
		this._id_to_key = {};
		this._key_to_ids = {};
		this._base_store.on("insert", function (row) {
			this._insert(row);
		}, this);
		this._base_store.on("remove", function (id) {
			this._remove(id);
		}, this);
		this._base_store.on("update", function (row) {
			if (!this._exists(row)) {
				this._remove(this._id(row));
				this._insert(row);
			}
		}, this);
	},
	
	destroy: function () {
		this._base_store.off(null, null, this);
		this._inherited(BetaJS.Stores.StoreIndex, "destroy");
	},
	
	rebuild: function () {
		var iter = this._base_store.query();
		while (iter.hasNext())
			this.insert(iter.next());
	},
	
	_id: function (row) {
		return row[this._base_store._id_key];
	},
	
	_key: function (row) {
		return row[this._index_key];
	},

	_insert: function (row) {
		var id = this._id(row);
		var key = this._key(row);
		this._id_to_key[id] = key;
		if (!(key in this._key_to_ids))
			this._key_to_ids[key] = {};
		this._key_to_ids[key][id] = true;
	},
	
	_remove: function (id) {
		var key = this._id_to_key[id];
		delete this._id_to_key[id];
		delete this._key_to_ids[id];
	},
	
	_exists: function (row) {
		return this._id(row) in this._id_to_key;
	},
	
	get: function (key) {
		return key in this._key_to_ids ? this._key_to_ids[key] : [];
	}
	
});

/*
BetaJS.Stores.SubStringStoreIndex = BetaJS.Stores.StoreIndex.extend("SubStringStoreIndex", {

	constructor: function (base_store, index_key) {
		this._inherited(BetaJS.Stores.SubStringStoreIndex, "constructor", base_store, index_key);
		this._substrings = {};
	},

	_insert: function (row) {
		this._inherited(BetaJS.Stores.SubStringStoreIndex, "_insert", row);
		var id = this._id(row);
		var key = this._key(row) + "";
		var current = this._substrings;
		while (key != "") {
			var c = key.charAt(0);
			key = key.substr(1);
			if (!(c in current))
				current[c] = {
					sub: {},
					ids: {}
				};
			current[c].ids[id] = true;
			current = current[c].sub;
		}
	},
	
	__remove_helper: function (current, key, id) {
		if (key == "")
			return;
		var c = key.charAt(0);
		key = key.substr(1);
		this.__remove_helper(current[c].sub, key, id);
		delete current[c].ids[id];
		if (BetaJS.Types.is_empty(current[c].ids))
			delete current[c];
	},

	_remove: function (id) {
		this.__remove_helper(this._substrings, this._id_to_key[id], id);
		this._inherited(BetaJS.Stores.SubStringStoreIndex, "_remove", id);		
	},

	get: function (key) {
		if (!BetaJS.Types.is_object(key)) 
			return this._inherited(BetaJS.Stores.SubStringStoreIndex, "get", key);
		key = key.value;
		if (key == "")
			return {};
		var current = this._substrings; 
		while (key != "") {
			var c = key.charAt(0);
			key = key.substr(1);
			if (!(c in current))
				return {};
			if (key == "")
				return current[c].ids;
			current = current[c].sub;
		}
		return {};
	}
	
});
*/
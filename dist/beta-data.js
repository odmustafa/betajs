/*!
  betajs - v0.0.1 - 2013-06-19
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
			data: JSON.stringify(options.data),
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
			data: JSON.stringify(options.data),
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

BetaJS.Stores = BetaJS.Stores || {};


BetaJS.Stores.StoreException = BetaJS.Exceptions.Exception.extend("StoreException");


/** @class */
BetaJS.Stores.BaseStore = BetaJS.Class.extend("BaseStore", [
	BetaJS.Events.EventsMixin,
	/** @lends BetaJS.Stores.BaseStore.prototype */
	{
	
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
	
	_insertEvent: function (row, external) {
		this.trigger("insert", row, external);		
		this.trigger("insert-" + external ? 'external' : 'internal', row);
	},
	
	_updateEvent: function (row, row_changed, external) {
		this.trigger("update", row, row_changed, external)
		this.trigger("update-" + external ? 'external' : 'internal', row, row_changed);
	},

	_removeEvent: function (row, external) {
		this.trigger("remove", row, external)
		this.trigger("remove-" + external ? 'external' : 'internal', row);
	},

	insert: function (data) {
		var row = this._insert(data);
		if (row)
			this._insertEvent(row, true);
		return row;
	},
	
	remove: function (id) {
		var row = this._remove(id);
		if (row)
			this._removeEvent(row, true);
		return row;
	},
	
	get: function (id) {
		return this._get(id);
	},
	
	update: function (id, data) {
		var row = this._update(id, data);
		if (row)
			this._updateEvent(row, data, true);
		return row;
	},
	
	query: function (query, options) {
		return BetaJS.Queries.Constrained.emulate(
			BetaJS.Queries.Constrained.make(query, options || {}),
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
	
	_insert: function (data) {
		var last_id = this._read_last_id();
		var id = 1;
		if (last_id != null) {
			id = last_id + 1;
			this._write_next_id(last_id, id);
			this._write_prev_id(id, last_id);
		} else
			this._write_first_id(id);
		data.id = id;
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
			delete data.id;
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

BetaJS.Stores.AssocStore = BetaJS.Stores.DumbStore.extend("AssocStore", {
	
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

BetaJS.Stores.LocalStore = BetaJS.Stores.AssocStore.extend("LocalStore", {
	
	constructor: function (prefix) {
		this._inherited(BetaJS.Stores.LocalStore, "constructor");
		this.__prefix = prefix;
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

BetaJS.Stores.MemoryStore = BetaJS.Stores.AssocStore.extend("MemoryStore", {
	
	_read_key: function (key) {
		return this[key];
	},
	
	_write_key: function (key, value) {
		this[key] = value;
	},
	
	_remove_key: function (key) {
		delete this[key];
	}
	
});

BetaJS.Stores.QueryCachedStore = BetaJS.Stores.BaseStore.extend("QueryCachedStore", {

	constructor: function (parent) {
		this._inherited(BetaJS.Stores.QueryCachedStore, "constructor");
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
			this.__cache[data.id] = data;
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
	
	_query: function (query, options) {
		var constrained = BetaJS.Queries.Constrained.make(query, options);
		var encoded = BetaJS.Queries.Constrained.format(constrained);
		if (encoded in this.__queries)
			return new BetaJS.Iterators.ArrayIterator(BetaJS.Objs.values(this.__cache));
		var result = this.__parent.query(query, options).asArray();
		for (var i = 0; i < result.length; ++i)
			this.__cache[result[i].id] = result[i];
		this.__queries[encoded] = true;
		return new BetaJS.Iterators.ArrayIterator(result);
	},	
	
});

BetaJS.Stores.FullyCachedStore = BetaJS.Stores.BaseStore.extend("FullyCachedStore", {

	constructor: function (parent, full_data) {
		this._inherited(BetaJS.Stores.FullyCachedStore, "constructor");
		this.__parent = parent;
		this.__cache = {};
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
			this.__cache[row.id] = row;
		}
	},

	_insert: function (data) {
		var result = this.__parent.insert(data);
		if (result)
			this.__cache[data.id] = data;
		return result;
	},
	
	_remove: function (id) {
		var result = this.__parent.remove(id);
		if (result)
			delete this.__cache[id];
		return result;
	},
	
	_get: function (id) {
		return this.__cache[id];
	},
	
	_update: function (id, data) {
		var result = this.__parent.update(id, data);
		if (result)
			this.__cache[id] = BetaJS.Objs.extend(this.__cache[id], data);
		return result;
	},
	
	_query: function (query, options) {
		return new BetaJS.Iterators.ArrayIterator(BetaJS.Objs.values(this.__cache));
	},	
	
});

BetaJS.Stores.RemoteStore = BetaJS.Stores.BaseStore.extend("RemoteStore", {

	constructor : function(uri, ajax, options) {
		this._inherited(BetaJS.Stores.RemoteStore, "constructor");
		this.__uri = uri;
		this.__ajax = ajax;
		this.__options = BetaJS.Objs.extend({
			"update_method": "PUT"
		}, options || {});
	},
	
	getUri: function () {
		return this.__uri;
	},

	_insert : function(data) {
		try {
			return this.__ajax.syncCall({method: "POST", uri: this.__uri, data: data});
		} catch (e) {
			throw new BetaJS.Stores.StoreException(BetaJS.Net.AjaxException.ensure(e).toString()); 			
		}
	},

	_remove : function(id) {
		try {
			var response = this.__ajax.syncCall({method: "DELETE", uri: this.__uri + "/" + id});
			return response ? response : {id:id};
		} catch (e) {
			throw new BetaJS.Stores.StoreException(BetaJS.Net.AjaxException.ensure(e).toString()); 			
		}
	},

	_get : function(id) {
		try {
			return this.__ajax.syncCall({uri: this.__uri + "/" + id});
		} catch (e) {
			throw new BetaJS.Stores.StoreException(BetaJS.Net.AjaxException.ensure(e).toString()); 			
		}
	},

	_update : function(id, data) {
		try {
			return this.__ajax.syncCall({method: this.__options.update_method, uri: this.__uri + "/" + id, data: data});
		} catch (e) {
			throw new BetaJS.Stores.StoreException(BetaJS.Net.AjaxException.ensure(e).toString()); 			
		}
	},
	
	_query : function(query, options) {
		try {			
			return this.__ajax.syncCall(this._encode_query(query, options));
		} catch (e) {
			throw new BetaJS.Stores.StoreException(BetaJS.Net.AjaxException.ensure(e).toString()); 			
		}
	},
	
	_encode_query: function (query, options) {
		return {
			uri: this.getUri()
		};		
	}
	
});


BetaJS.Stores.QueryGetParamsRemoteStore = BetaJS.Stores.RemoteStore.extend("QueryGetParamsRemoteStore", {

	constructor : function(uri, ajax, capability_params, options) {
		this._inherited(BetaJS.Stores.RemoteStore, "constructor", options);
		this.__uri = uri;
		this.__ajax = ajax;
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
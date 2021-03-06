Scoped.define("module:Classes.InvokerMixin", [
    "module:Objs", "module:Types", "module:Functions"
], function (Objs, Types, Functions) {
	
	/**
	 * Invoker Mixin, delegating method calls to an invocation function.
	 * 
	 * @mixin BetaJS.Classes.InvokerMixin
	 */
	return {
		
		/**
		 * Delegate member functio names to an invoker function.
		 * 
		 * @param {function} invoker invoker delegation function
		 * @param {array} members array of member function names
		 */
		invoke_delegate : function (invoker, members) {
			if (!Types.is_array(members))
				members = [members];
			invoker = this[invoker];
			var self = this;
			Objs.iter(members, function (member) {
				this[member] = function(member) {
					return function() {
						var args = Functions.getArguments(arguments);
						args.unshift(member);
						return invoker.apply(self, args);
					};
				}.call(self, member);
			}, this);
		}
	};
});




Scoped.define("module:Classes.HelperClassMixin", [
    "module:Objs", "module:Types", "module:Functions", "module:Promise"
], function (Objs, Types, Functions, Promise) {
	
	/**
	 * HelperClass Mixin
	 * 
	 * @mixin BetaJS.Classes.HelperClassMixin
	 */
	return {
	
		/**
		 * Add Helper Class
		 * 
		 * @param {class} helper_class helper class to add
		 * @param {objects} options optional options
		 * 
		 * @return {object} added helper instance
		 */
		addHelper: function (helper_class, options) {
			var helper = new helper_class(this, options);
			this.__helpers = this.__helpers || [];
			this.__helpers.push(this._auto_destroy(helper));
			return helper;
		},
		
		/**
		 * Notify all helpers of a method call.
		 * 
		 * @param {objects} options method call options
		 * @return accumlated return value
		 */
		_helper: function (options) {
			this.__helpers = this.__helpers || [];
			if (Types.is_string(options)) {
				options = {
					method: options
				};
			}
			options = Objs.extend({
				fold_start: null,
				fold: function (acc, result) {
					return acc || result;
				}
			}, options);
			var args = Functions.getArguments(arguments, 1);
			var acc = options.async ? Promise.create(options.fold_start) : options.fold_start;
			for (var i = 0; i < this.__helpers.length; ++i) {
				var helper = this.__helpers[i];
				if (options.method in helper) {
					if (options.async)
						acc = Promise.func(options.fold, acc, Promise.methodArgs(helper, helper[options.method], args));
					else
						acc = options.fold(acc, helper[options.method].apply(helper, args));
				}
			}
			return acc;
		}
		
	};
});



Scoped.define("module:Classes.PathResolver", [
    "module:Class", "module:Objs"
], function (Class, Objs, scoped) {
	return Class.extend({scoped: scoped}, function (inherited) {
		
		/**
		 * Path Resolver Class
		 * 
		 * @class BetaJS.Classes.PathResolver
		 */
		return {

			/**
			 * Creates a new instance.
			 * 
			 * @param {object} bindings path resolution bindings
			 */
			constructor: function (bindings) {
				inherited.constructor.call(this);
				this._bindings = bindings || {};
			},
			
			/**
			 * Extend instance by more bindings.
			 * 
			 * @param {object} bindings bindings to extend
			 * @param {string} namespace optional namespace
			 * 
			 */
			extend: function (bindings, namespace) {
				if (namespace) {
					for (var key in bindings) {
						var value = bindings[key];
						var regExp = /\{([^}]+)\}/;
						while (true) {
							var matches = regExp.exec(value);
							if (!matches)
								break;
							value = value.replace(regExp, namespace + "." + matches[1]);
						}
						this._bindings[namespace + "." + key] = value;
					}
				} else
					this._bindings = Objs.extend(this._bindings, bindings);
			},
			
			/**
			 * Map an array of path expressions to their resolutions.
			 * 
			 * @param {array} arr list of path expression
			 * 
			 * @return {array} resolved expressions
			 */
			map: function (arr) {
				var result = [];
				for (var i = 0; i < arr.length; ++i) {
					if (arr[i])
						result.push(this.resolve(arr[i]));
				}
				return result;
			},
			
			/**
			 * Resolve a path rexpression.
			 * 
			 * @param {string} path path expression to resolve
			 * 
			 * @return {string} resolved path expression
			 */
			resolve : function(path) {
				var regExp = /\{([^}]+)\}/;
				while (true) {
					var matches = regExp.exec(path);
					if (!matches)
						break;
					path = path.replace(regExp, this._bindings[matches[1]]);
				}
				return this.simplify(path);
			},
			
			/**
			 * Simplify a path expression.
			 * 
			 * @param {string} path path expression to simplify
			 * 
			 * @return {string} simplified path expression
			 */
			simplify: function (path) {
				return path.replace(/[^\/]+\/\.\.\//, "").replace(/\/[^\/]+\/\.\./, "");
			}
	
		};
	});
});


Scoped.define("module:Classes.MultiDelegatable", [
    "module:Class", "module:Objs"
], function (Class, Objs, scoped) {	
	return Class.extend({scoped: scoped}, function (inherited) {
		
		/**
		 * Multi Delegatable Class
		 * 
		 * @class BetaJS.Classes.MultiDelegatable
		 */
		return {

			/**
			 * Creates a new instance.
			 * 
			 * @param {array} objects list of objects
			 * @param {array} methods list of methods
			 */
			constructor: function (objects, methods) {
				inherited.constructor.call(this);
				Objs.iter(methods, function (method) {
					this[method] = function () {
						var args = arguments;
						Objs.iter(objects, function (object) {
							object[method].apply(object, args);
						}, this);
						return this;
					};
				}, this);
			}
			
		};
	});
});



Scoped.define("module:Classes.ObjectIdScopeMixin", function () {
	
	/**
	 * Object Id Scope Mixin
	 * 
	 * @mixin BetaJS.Classes.ObjectIdScopeMixin
	 */
	return {

		__objects: {},

		/**
		 * Return object for specific id
		 * 
		 * @param {string} id id of object
		 * 
		 * @return {object} object in question
		 */
	    get: function (id) {
	        return this.__objects[id];
	    }

	};
});	
	
		
Scoped.define("module:Classes.ObjectIdScope", [
    "module:Class", "module:Classes.ObjectIdScopeMixin"
], function (Class, Mixin, scoped) {
	return Class.extend({scoped: scoped}, Mixin, function (inherited) {
		
		/**
		 * Objecct Id Scope Class
		 * 
		 * @class BetaJS.Classes.ObjectIdScope
		 */
		return {

			/**
			 * Create or return singleton instance of this class.
			 * 
			 * @return {object} singleton instance
			 */
			singleton: function () {
				if (!this.__singleton)
					this.__singleton = new this();
				return this.__singleton;
			}
		};
	});
});


Scoped.define("module:Classes.ObjectIdMixin", [
    "module:Classes.ObjectIdScope", "module:Objs", "module:Ids"
], function (ObjectIdScope, Objs, Ids) {
	
	/**
	 * Object Id Mixin
	 * 
	 * @mixin BetaJS.Classes.ObjectIdMixin
	 */
	return {
	
	    _notifications: {
	        construct: "__register_object_id",
	        destroy: "__unregister_object_id"
	    },
	
	    __object_id_scope: function () {
	    	if (!this.object_id_scope)
	    		this.object_id_scope = ObjectIdScope.singleton();
            return this.object_id_scope;
	    },
	
	    __register_object_id: function () {
	        var scope = this.__object_id_scope();
	        scope.__objects[this.cid()] = this;
	    },
	
	    __unregister_object_id: function () {
	        var scope = this.__object_id_scope();
	        delete scope.__objects[this.cid()];
	    }
	
	};
});

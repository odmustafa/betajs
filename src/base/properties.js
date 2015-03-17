Scoped.define("module:Properties.PropertiesMixin", [
    "module:Objs.Scopes",
    "module:Objs",
	"module:Strings",
	"module:Types",
	"module:Functions"
	], function (Scopes, Objs, Strings, Types, Functions) {
	
	return {
			
		_notifications: {
			"construct": function () {
				this.__properties = {
					// hierarchical organization
					data: {},
					// hierarchical organization
					watchers: {
						children: {},
						eventCount: 0,
						parent: null,
						key: null
					},
					// flat organization
					computed: {},
					// flat organization
					bindings: {}
				};
			},
			"destroy": function () {
				Objs.iter(this.__properties.bindings, function (value, key) {
					this.unbind(key);
				}, this);
				this.trigger("destroy");
			},
			"register_event": function (event) {
				Objs.iter(["change", "unset", "deepchange", "deepunset", "strongdeepchange", "strongchange"], function (eventType) {
					if (Strings.starts_with(event, eventType + ":"))
						this.__registerWatcher(Strings.strip_start(event, eventType + ":"), eventType);
				}, this);
			},
			"unregister_event": function (event) {
				Objs.iter(["change", "unset", "deepchange", "deepunset", "strongdeepchange", "strongchange"], function (eventType) {
					if (Strings.starts_with(event, eventType + ":"))
						this.__unregisterWatcher(Strings.strip_start(event, eventType + ":"), eventType);
				}, this);
			}
		},
		
		get: function (key) {
			return Scopes.get(key, this.__properties.data);
		},
		
		_canSet: function (key, value) {
			return true;
		},
		
		_beforeSet: function (key, value) {
			return value;
		},
		
		_afterSet: function (key, value) {},
		
		has: function (key) {
			return Scopes.has(key, this.__properties.data);
		},
		
		setAll: function (obj) {
			for (var key in obj)
				this.set(key, obj[key]);
			return this;
		},
		
		keys: function (mapped) {
			return Objs.keys(this.__properties.data, mapped);
		},
		
		data: function () {
			return this.__properties.data;
		},
		
		getAll: function () {
			return Objs.clone(this.__properties.data, 1);
		},
		
		__registerWatcher: function (key, event) {
			var keys = key ? key.split(".") : [];
			var current = this.__properties.watchers;
			for (var i = 0; i < keys.length; ++i) {
				if (!(keys[i] in current.children)) {
					current.children[keys[i]] = {
						parent: current,
						eventCount: 0,
						children: {},
						key: keys[i]
					};
				}
				current = current.children[keys[i]];
			}
			current.eventCount++;
		},
		
		__unregisterWatcher: function (key, event) {
			var keys = key ? key.split(".") : [];
			var current = this.__properties.watchers;
			for (var i = 0; i < keys.length; ++i) {
				if (current)
					current = current.children[keys[i]];
			}
			if (!current)
				return;
			current.eventCount--;
			while (current.eventCount <= 0 && Types.is_empty(current.children) && current.parent) {
				var parent = current.parent;
				delete parent.children[current.key];
				current = parent;
			}
		},
		
		uncompute: function (key) {
			if (key in this.__properties.computed) {
				Objs.iter(this.__properties.computed[key].dependencies, function (dependency) {
					dependency.properties.off("change:" + dependency.key, null, dependency);
				}, this);
				delete this.__properties.computed[key];
			}
			return this;
		},
		
		compute: function (key, func) {
			var args = Functions.matchArgs(arguments, 2, {
				setter: "function",
				context: {
					type: "object",
					def: this
				},
				dependencies: true
			});
			this.uncompute(key);
			var deps = [];
			Objs.iter(args.dependencies, function (dep) {
				if (Types.is_string(dep))
					deps.push({properties: this, key: dep});
				else
					deps.push({properties: dep[0], key: dep[1]});
			}, this);
			var computed = {
				ignore: 0,
				func: func,
				context: args.context,
				setter: args.setter,
				dependencies: deps
			};
			this.__properties.computed[key] = computed;
			var self = this;
			function recompute() {
				if (computed.ignore > 0)
					return;
				var values = Objs.map(deps, function (dep) {
					return dep.properties.get(dep.key);
				});
				self.set(key, func.apply(args.context, values));
			}
			for (var i = 0; i < deps.length; ++i) {
				deps[i].properties.on("change:" + deps[i].key, function () {
					recompute();
				}, deps[i]);
			}
			recompute();
			return this;
		},
		
		unbind: function (key, props) {
			if (key in this.__properties.bindings) {
				for (var i = this.__properties.bindings[key].length - 1; i >= 0; --i) {
					var binding = this.__properties.bindings[key][i];
					if (!props || props == binding) {
						if (binding.left) 
							binding.properties.off(null, null, binding);
						if (binding.right)
							this.off(null, null, binding);
						this.__properties.bindings[key].splice(i, 1);
						i--;
					}
				}
				if (this.__properties.bindings[key].length === 0)
					delete this.__properties.bindings[key];
			}
			return this;
		},
		
		bind: function (key, properties, options) {
			options = Objs.extend({
				secondKey: key,
				left: true,
				right: true,
				deep: false
			}, options);
			var binding = {
				key: options.secondKey,
				left: options.left,
				right: options.right,
				deep: options.deep,
				properties: properties
			};
			this.__properties.bindings[key] = this.__properties.bindings[key] || [];
			this.__properties.bindings[key].push(binding);
			if (binding.left) {
				var self = this;
				binding.properties.on("strongchange:" + binding.key, function (value) {
					self.set(key, value);
				}, binding);
				binding.properties.on("unset:" + binding.key, function (value) {
					self.unset(key);
				}, binding);
				if (binding.deep) {
					binding.properties.on("strongdeepchange:" + binding.key, function (value, oldValue, subKey) {
						if (self.get(key ? key + "." + subKey : subKey) === value)
							self.__setChanged(key ? key + "." + subKey : subKey, value, oldValue, true);
						else
							self.set(key ? key + "." + subKey : subKey, value);					
					}, binding);
					binding.properties.on("deepunset:" + binding.key, function (oldValue, subKey) {
						if (!self.has(key ? key + "." + subKey : subKey))
							self.__unsetChanged(key ? key + "." + subKey : subKey, oldValue);
						else
							self.unset(key ? key + "." + subKey : subKey);					
					}, binding);
				}
				if (!binding.right || !this.has(key))
					this.set(key, binding.properties.get(binding.key));
			}
			if (binding.right) {
				this.on("strongchange:" + key, function (value) {
					binding.properties.set(binding.key, value);
				}, binding);
				this.on("unset:" + key, function (value) {
					binding.properties.unset(binding.key);
				}, binding);
				if (binding.deep) {
					this.on("strongdeepchange:" + key, function (value, oldValue, subKey) {
						if (binding.properties.get(binding.key ? binding.key + "." + subKey : subKey) === value)
							binding.properties.__setChanged(binding.key ? binding.key + "." + subKey : subKey, value, oldValue, true);
						else
							binding.properties.set(binding.key ? binding.key + "." + subKey : subKey, value);
					}, binding);
					this.on("deepunset:" + key, function (oldValue, subKey) {
						if (!binding.properties.has(binding.key ? binding.key + "." + subKey : subKey))
							binding.properties.__unsetChanged(binding.key ? binding.key + "." + subKey : subKey, oldValue);
						else
							binding.properties.unset(binding.key ? binding.key + "." + subKey : subKey);
					}, binding);
				}
				if (!binding.left || this.has(key))
					binding.properties.set(binding.key, this.get(key));
			}
			binding.properties.on("destroy", function () {
				this.unbind();
			}, this);
			return this;
		},
		
		__unsetChanged: function (key, oldValue) {
			this.trigger("unset", key, oldValue);
			var keys = key ? key.split(".") : [];
			var current = this.__properties.watchers;
			var head = "";
			var tail = key;
			for (var i = 0; i < keys.length; ++i) {
				if (current.eventCount > 0)
					this.trigger("deepunset:" + head, oldValue, tail);
				if (!(keys[i] in current.children))
					return this;
				current = current.children[keys[i]];
				head = head ? (head + "." + keys[i]) : keys[i];
				tail = Strings.first_after(tail, ".");
			}
			function process_unset(current, key, oldValue) {
				if (Types.is_undefined(oldValue))
					return;
				if (current.eventCount > 0)
					this.trigger("unset:" + key, oldValue);
				Objs.iter(current.children, function (child, subkey) {
					process_unset.call(this, child, key ? (key + "." + subkey) : subkey, oldValue[subkey]);
				}, this);
			}
			process_unset.call(this, current, key, oldValue);
			return this;
		},
		
		__setChanged: function (key, value, oldValue, notStrong) {
			this.trigger("change", key, value, oldValue);
			this._afterSet(key, value);
			var keys = key ? key.split(".") : [];
			var current = this.__properties.watchers;
			var head = "";
			var tail = key;
			for (var i = 0; i < keys.length; ++i) {
				if (current.eventCount > 0) {
					if (!notStrong)
						this.trigger("strongdeepchange:" + head, value, oldValue, tail);
					this.trigger("deepchange:" + head, value, oldValue, tail);
				}
				if (!(keys[i] in current.children))
					return;
				current = current.children[keys[i]];
				head = head ? (head + "." + keys[i]) : keys[i];
				tail = Strings.first_after(tail, ".");
			}
			function process_set(current, key, value, oldValue) {
				if (value == oldValue)
					return;
				if (current.eventCount > 0) {
					if (!notStrong)
						this.trigger("strongchange:" + key, value, oldValue);
					this.trigger("change:" + key, value, oldValue);
				}
				Objs.iter(current.children, function (child, subkey) {
					process_set.call(this, child, key ? (key + "." + subkey) : subkey, Types.is_object(value) && value ? value[subkey] : null, Types.is_object(oldValue) && oldValue ? oldValue[subkey] : null);
				}, this);
			}
			process_set.call(this, current, key, value, oldValue);
		},
		
		unset: function (key) {
			if (this.has(key)) {
				var oldValue = this.get(key);
				Scopes.unset(key, this.__properties.data);
				this.__unsetChanged(key, oldValue);
			}
			return this;
		},
		
		__properties_guid: "ec816b66-7284-43b1-a945-0600c6abfde3",
		
		set: function (key, value, force) {
			if (Types.is_object(value) && value && value.guid == this.__properties_guid) {
				if (value.properties)
					this.bind(key, value.properties, {secondKey: value.key});
				if (value.func)
					this.compute(key, value.func, value.dependencies);
				return this;
			}
			value = this._beforeSet(key, value);
			var oldValue = this.get(key);
			if (oldValue !== value) {
				Scopes.set(key, value, this.__properties.data);
				this.__setChanged(key, value, oldValue);
			} else if (force) {
				this.trigger("change", key, value, oldValue);
				this.trigger("change:" + key, value, oldValue);
			}
			return this;
		},
		
		binding: function (key) {
			return {
				guid: this.__properties_guid,
				properties: this,
				key: key
			};
		},
		
		computed : function (f, dependencies) {
			return {
				guid: this.__properties_guid,
				func: f,
				dependencies: dependencies
			};
		}	
		
	};
});


Scoped.define("module:Properties.Properties", [
	    "module:Class",
	    "module:Events.EventsMixin",
	    "module:Properties.PropertiesMixin"
	], function (Class, EventsMixin, PropertiesMixin, scoped) {
	return Class.extend({scoped: scoped}, [EventsMixin, PropertiesMixin, function (inherited) {
		return {
			constructor: function (obj) {
				inherited.constructor.call(this);
				if (obj)
					this.setAll(obj);
			}
		};
	}]);
});
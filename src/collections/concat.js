Scoped.define("module:Collections.ConcatCollection", [
    "module:Collections.Collection",
    "module:Objs",
    "module:Functions"
], function (Collection, Objs, Functions, scoped) {
	return Collection.extend({scoped: scoped}, function (inherited) {
		
		/**
		 * A Concat Collection allows you to dynamically concatinate Collections 
		 * 
		 * @class BetaJS.Collections.ConcatCollection
		 */
		return {

			/**
			 * Instantiate a Concat Collection.
			 * 
			 * @param {array} parents List of parent collections
			 * @param {object} options Collection options
			 * 
			 */
			constructor: function (parents, options) {
				this.__parents = {};
				this.__itemToParent = {};
				options = options || {};
				delete options.objects;
				options.compare = Functions.as_method(this.__compareByParent, this);
				inherited.constructor.call(this, options);				
				var idx = 0;
				Objs.iter(parents, function (parent) {
					this.__parents[parent.cid()] = {
						idx: idx,
						parent: parent
					};
					parent.iterate(function (item) {
						this.__parentAdd(parent, item);
					}, this);
					parent.on("add", function (item) {
						this.__parentAdd(parent, item);
					}, this);
					parent.on("remove", function (item) {
						this.__parentRemove(parent, item);
					}, this);
					idx++;
				}, this);
			},
			
			/**
			 * @override
			 */
			destroy: function () {
				Objs.iter(this.__parents, function (parent) {
					parent.parent.off(null, null, this);
				}, this);
				inherited.destroy.call(this);
			},
			
			__parentAdd: function (parent, item) {
				this.__itemToParent[item.cid()] = parent;
				this.add(item);
			},
			
			__parentRemove: function (parent, item) {
				delete this.__itemToParent[item.cid()];
				this.remove(item);
			},
			
			__compareByParent: function (item1, item2) {
				var parent1 = this.__itemToParent[item1.cid()];
				var parent2 = this.__itemToParent[item2.cid()];
				if (parent1 === parent2)
					return parent1.getIndex(item1) - parent2.getIndex(item2);
				return this.__parents[parent1.cid()].idx - this.__parents[parent2.cid()].idx;
			}			
		
		};	
	});
});

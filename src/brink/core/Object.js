$b(

    [
        '../config',
        './CoreObject',
        '../utils/get',
        '../utils/set',
        '../utils/clone',
        '../utils/merge',
        '../utils/bindTo',
        '../utils/flatten',
        '../utils/intersect',
        '../utils/isFunction',
        '../utils/expandProps',
        '../utils/bindFunction',
        '../utils/getObjKeyPair',
        '../utils/defineProperty'

    ],

    function (
        config,
        CoreObject,
        get,
        set,
        clone,
        merge,
        bindTo,
        flatten,
        intersect,
        isFunction,
        expandProps,
        bindFunction,
        getObjKeyPair,
        defineProperty
    ) {

        'use strict';

        var Obj;

        Obj = CoreObject.extend({

            /***********************************************************************

            `Brink.Object` is the primary base Class. Most of your Objects will
            extend this Class, unless you need the added functionality of Brink.Class.

            @class Object
            @namespace Brink
            @extends Brink.CoreObject
            @constructor
            ************************************************************************/

            __init : function (o) {

                var p,
                    meta;

                if (!this.__meta) {
                    this.__parsePrototype.call(this);
                    meta = this.__meta;
                }

                else {
                    meta = this.__buildMeta();
                }

                if (o && typeof o === 'object' && !Array.isArray(o)) {

                    o = clone(o);

                    for (p in o) {
                        this.prop(p, o[p]);
                    }
                }

                for (p in meta.properties) {
                    this.__defineProperty.call(this, p, meta.properties[p]);
                }

                if (this.init) {
                    this.init.apply(this, arguments);
                }

                meta.isInitialized = true;

                if ($b.instanceManager) {
                    $b.instanceManager.add(this, meta);
                }

                return this;
            },

            __buildMeta : function () {

                var meta;

                meta = this.__meta = clone(this.__meta || {});

                meta.getters = clone(meta.getters || {});
                meta.setters = clone(meta.setters || {});

                meta.properties = clone(meta.properties || {});
                meta.methods = clone(meta.methods || []);
                meta.dependencies = clone(meta.dependencies || []);

                meta.values = {};
                meta.watchers = {
                    fns : [],
                    props : []
                };

                return meta;
            },

            __parsePrototype : function () {

                var p,
                    v,
                    meta;

                meta = this.__buildMeta();

                for (p in this) {

                    v = this[p];

                    if (isFunction(v)) {
                        if (p !== 'constructor' && !~meta.methods.indexOf(p)) {
                           meta.methods.push(p);
                        }
                    }

                    else if (this.hasOwnProperty(p)) {

                        if (p !== '__meta') {

                            if (v && v.__isRequire && ~!meta.dependencies.indexOf(p)) {
                                meta.dependencies.push(p);
                            }

                            else {
                                this.prop.call(this, p, v);
                            }
                        }
                    }
                }

            },

            __defineProperty : function (p, d) {

                if (!config.DIRTY_CHECK) {

                    d = clone(d);

                   // Modern browsers, IE9 +
                    if (Object.defineProperty) {
                        Object.defineProperty(this, p, d);
                    }

                    // Old FF
                    else if (this.__defineGetter__) {
                        this.__defineGetter__(p, d.get);
                        this.__defineSetter__(p, d.set);
                    }

                    else {
                        this.__meta.pojoStyle = true;
                    }

                    if (typeof d.defaultValue !== 'undefined') {
                        this.set(p, d.defaultValue, true, true);
                    }
                }

                else {
                    this.__meta.pojoStyle = true;
                    this[p] = d.defaultValue;
                }

                if (d.watch && d.watch.length) {
                    this.watch(d.watch, d.didChange);
                }
            },

            __undefineProperties : function () {

                var p;

                for (p in this.__meta.properties) {
                    delete this[p];
                }
            },

            __readOnly : function (p) {

                if (this.__meta.pojoStyle) {
                    return $b.error('Tried to write to a read-only property `' + p + '` on ' + this);
                }
            },

            __writeOnly : function (p) {

                if (this.__meta.pojoStyle) {
                    return $b.error('Tried to read a write-only property `' + p + '` on ' + this);
                }
            },

            __defineGetter : function (p, fn) {

                if (isFunction(fn)) {
                    this.__meta.getters[p] = fn;
                }

                return function () {
                    return this.get(p);
                };
            },

            __defineSetter : function (p, fn) {

                if (isFunction(fn)) {
                    this.__meta.setters[p] = fn;
                }

                return function (val) {
                    return this.set(p, val);
                };
            },

            /***********************************************************************
            Invalidate one or more properties. This will trigger any bound and computed properties
            depending on these properties to also get updated.

            This will also trigger any watchers of this property in the next Run Loop.

            @method propertyDidChange
            @param  {Array|String} props A single property or an array of properties.
            ************************************************************************/
            propertyDidChange : function () {

                var props;

                props = flatten([].slice.call(arguments, 0, arguments.length));

                if ($b.instanceManager) {
                    $b.instanceManager.propertyDidChange(this, props);
                }
            },

            /***********************************************************************
            Gets a subset of properties on this object.

            @method getProperties
            @param {Array} keys A listof keys you want to get
            @return {Object} Object of key : value pairs for properties in `keys`.
            ************************************************************************/
            getProperties : function () {

                var i,
                    p,
                    o,
                    props;

                props = flatten([].slice.call(arguments, 0, arguments.length));
                o = {};

                if (props.length) {

                    for (i = 0; i < props.length; i ++) {
                        o[props[i]] = this.get(props[i]);
                    }

                    return o;
                }

                for (p in this.__meta.properties) {
                    o[p] = this.get(p);
                }

                return o;
            },

            /***********************************************************************
            Gets all properties that have changed since the last Run Loop.

            @method getChangedProperties
            @return {Object} Object of key : value pairs for all changed properties.
            ************************************************************************/
            getChangedProperties : function () {
                return this.getProperties.apply(this, this.__meta.changedProps);
            },

            /***********************************************************************
            Get or create a property descriptor.

            @method prop
            @param {String} key Poperty name.
            @param [val] Default value to use for the property.
            @return {PropertyDescriptor}
            ************************************************************************/
            prop : function (key, val) {

                var obj;

                obj = getObjKeyPair(this, key);
                key = obj[1];
                obj = obj[0];

                if (typeof obj.__meta.properties[key] !== 'undefined') {
                    if (typeof val === 'undefined') {
                        return obj.__meta.properties[key];
                    }
                }

                if (!val || !val.__isComputed) {

                    val = {
                        get : true,
                        set : true,
                        value : val
                    };
                }

                val = obj.__meta.properties[key] = defineProperty(obj, key, val);
                val.key = key;

                val.bindTo = bindFunction(function (o, p) {
                    o.prop(p, bindTo(obj, key, true));
                }, obj);

                val.didChange = bindFunction(function () {
                    obj.propertyDidChange(key);
                }, obj);

                if (obj.__meta.isInitialized) {
                    obj.__defineProperty(key, val);
                }

                return val;
            },

            /***********************************************************************
            Bind a property to a property on another object.

            This can also be achieved with : `a.prop('name').bindTo(b, 'name');`

            @method bindProperty
            @param {String} key Poperty name on ObjectA.
            @param {Brink.Object} obj ObjectB, whose property you want to bind to.
            @param {String} key2 Property name on ObjectB.
            ***********************************************************************/
            bindProperty : function (key, obj, key2) {
                return this.prop(key).bindTo(obj, key2);
            },

            /***********************************************************************
            Get the value of a property.

            This is identical to doing `obj.key` or `obj[key]`,
            unless you are supporting <= IE8.

            @method get
            @param {String} key The property to get.
            @return The value of the property or `undefined`.
            ***********************************************************************/
            get : function (key) {
                return get(this, key);
            },

            /***********************************************************************
            Set the value of a property.

            This is identical to doing `obj.key = val` or `obj[key] = val`,
            unless you are supporting <= IE8.

            You can also use this to set nested properties.
            I.e. `obj.set('some.nexted.key', val)`

            @method set
            @param {String} key The property to set.
            @param val The value to set.
            @return The value returned from the property's setter.
            ***********************************************************************/
            set : function (key, val, quiet, skipCompare) {
                return set(this, key, val, quiet, skipCompare);
            },

            /***********************************************************************
            Watch a property or properties for changes.

            ```javascript

            var obj = $b.Object.create({

                color : 'green',
                firstName : 'Joe',
                lastName : 'Schmoe',

                init : function () {
                    this.watch('color', this.colorChanged.bind(this));
                    this.watch(['firstName', 'lastName'], this.nameChanged.bind(this));
                },

                colorChanged : function () {
                    console.log(this.color);
                },

                nameChanged : function () {
                    console.log(this.firstName + ' ' + this.lastName);
                }
            });

            obj.color = 'red';
            obj.firstName = 'John';
            obj.lastName = 'Doe';

            ```

            Watcher functions are only invoked once per Run Loop, this means that the `nameChanged`
            method above will only be called once, even though we changed two properties that
            `nameChanged` watches.

            You can skip the `props` argument to watch all properties on the Object.

            @method watch
            @param {null|String|Array} props The property or properties to watch.
            @param {Function} fn The function to call upon property changes.
            ***********************************************************************/
            watch : function () {

                var fn,
                    props;

                props = arguments[0];
                fn = arguments[1];

                if ($b.instanceManager) {

                    if (typeof fn !== 'function') {

                        fn = [].slice.call(arguments, arguments.length - 1, arguments.length)[0];

                        if (arguments.length === 1) {
                            props = [];
                        }

                        else {
                            props = expandProps(flatten([].slice.call(arguments, 0, arguments.length - 1)));
                        }
                    }

                    else {
                        props = expandProps([].concat(props));
                    }

                    $b.instanceManager.watch(this, props, fn);
                }

                else {
                    $b.error('InstanceManager does not exist, can\'t watch for property changes.');
                }
            },

            /***********************************************************************
            Remove a watcher.

            @method unwatch
            @param {Function|Array} fns The function(s) you no longer want to trigger on property changes.
            ***********************************************************************/
            unwatch : function () {

                if ($b.instanceManager) {
                    $b.instanceManager.unwatch(this, flatten(arguments));
                }

                else {
                    $b.error('InstanceManager does not exist, can\'t watch for property changes.');
                }

            },

            /***********************************************************************
            Remove all watchers watching properties this object.

            This gets called automatically during `destroy()`, it's not very common
            you would want to call this directly.

            USE WITH CAUTION. Any and all other objects that have bound properties,
            watchers or computed properties dependent on this Object instance will
            stop working.

            @method unwatchAll
            ***********************************************************************/
            unwatchAll : function () {

                if ($b.instanceManager) {
                    $b.instanceManager.unwatchAll(this);
                }

                else {
                    $b.error('InstanceManager does not exist, can\'t watch for property changes.');
                }
            },

            willNotifyWatchers : function () {

            },

            didNotifyWatchers : function () {
                if (this.__meta) {
                    this.__meta.changedProps = [];
                }
            },

            /***********************************************************************
            Destroys an object, removes all bindings and watchers and clears all metadata.

            In addition to calling `destroy()` be sure to remove all
            references to the object so that it gets Garbage Collected.

            @method destroy
            ***********************************************************************/
            destroy : function () {

                this.unwatchAll();
                this.__undefineProperties();

                if ($b.instanceManager) {
                    $b.instanceManager.remove(this);
                }

                this.__meta = null;
            }
        });

        Obj.extend = function () {

            var proto,
                SubObj;

            SubObj = CoreObject.extend.apply(this, arguments);

            proto = SubObj.prototype;
            proto.__parsePrototype.call(proto);

            return SubObj;
        };

        Obj.define = function () {
            $b.define(this.prototype.__dependencies, bindFunction(this.resolveDependencies, this));
            return this;
        };

        Obj.resolveDependencies = function () {

            var proto,
                p;

            proto = this.prototype;

            for (p in proto.__dependencies) {
                proto[p] = proto.__dependencies[p].resolve();
            }

            this.__meta.dependenciesResolved = true;

            return this;
        };

        Obj.load = function (cb) {

            cb = typeof cb === 'function' ? cb : function () {};

            if (this.__meta.dependenciesResolved) {
                cb(this);
            }

            $b.require(this.prototype.__dependencies, bindFunction(function () {
                this.resolveDependencies.call(this);
                cb(this);
            }, this));

            return this;
        };

        Obj.__meta = merge(Obj.__meta || {}, {isObject: true});

        return Obj;
    }

).attach('$b');
/**
 * CloudPelican javascript library
 * @version 0.2
 * @author Robin Verlangen
 */
cloudpelican = {
    /**
     * Configuration
     * @type Object
     */
    config : {
        endpoint : 'https://api.cloudpelican.com/api/push/',
        token : '',
        write_interval_ms : 200,
        listeners : {
            window_error : true,
            console_log : true,
            console_error : true,
            console_warn : true,
            console_debug : true,
            console_trace : true
        }
    },
    
    
    _oldListeners : {}, /** Placeholder for listeners */
    
    /**
     * Execute an existing error/log listener
     * @param {type} name
     * @param {type} thisRef
     * @param {type} args
     * @returns {@exp;method@call;apply|Boolean}
     */
    _applyOldListener : function(name, thisRef, args) {
        var method = cloudpelican._oldListeners[name];
        if (typeof method === 'function') {
            return method.apply(thisRef, args);
        }
        return false;
    },
     /**
     * Init
     * @returns {boolean}
     */
    init : function () {
        /** Window error */
        if (cloudpelican.config.listeners.window_error === true) {
            cloudpelican._oldListeners['window_error'] = window.onerror;
            window.onerror = function() {
                /** Forward to our log */
                try {
                    var msg = arguments[0];
                    cloudpelican.log(msg, true, { url : arguments[1], line : arguments[2] }); /** Message, url, line and error flag set to true */
                } catch (e) {
                    console.log(e);
                }
                
                /** Run existing handles */
                return cloudpelican._applyOldListener('window_error', window, arguments);
            };
        }
        
        /** Console: log */
        if (cloudpelican.config.listeners.console_log === true) {
            cloudpelican._oldListeners['console_log'] = console.log;
            console.log = function() {
                /** Forward to our log */
                try {
                    var msg = arguments[0];
                    cloudpelican.log(msg, false); /** Message */
                } catch (e) {
                    /** Make sure no matter what happens in the CloudPelican log we continue the regular console output */
                }
                
                /** Run existing handles */
                return cloudpelican._applyOldListener('console_log', console, arguments);
            };
        }
        
        /** Console: error */
        if (cloudpelican.config.listeners.console_error === true) {
            cloudpelican._oldListeners['console_error'] = console.error;
            console.error = function() {
                /** Forward to our log */
                try {
                    var msg = arguments[0];
                    cloudpelican.log(msg, true); /** Message and error flag set to true */
                } catch (e) {
                    /** Make sure no matter what happens in the CloudPelican log we continue the regular console output */
                }
                
                /** Run existing handles */
                return cloudpelican._applyOldListener('console_error', console, arguments);
            };
        }
        
        /** Console: warn */
        if (cloudpelican.config.listeners.console_warn === true) {
            cloudpelican._oldListeners['console_warn'] = console.warn;
            console.warn = function() {
                /** Forward to our log */
                try {
                    var msg = arguments[0];
                    cloudpelican.log(msg, true); /** Message and error flag set to true */
                } catch (e) {
                    /** Make sure no matter what happens in the CloudPelican log we continue the regular console output */
                }
                
                /** Run existing handles */
                return cloudpelican._applyOldListener('console_warn', console, arguments);
            };
        }
        
        /** Console: debug */
        if (cloudpelican.config.listeners.console_debug === true) {
            cloudpelican._oldListeners['console_debug'] = console.debug;
            console.debug = function() {
                /** Forward to our log */
                try {
                    var msg = arguments[0];
                    cloudpelican.log(msg, false); /** Message */
                } catch (e) {
                    /** Make sure no matter what happens in the CloudPelican log we continue the regular console output */
                }
                
                /** Run existing handles */
                return cloudpelican._applyOldListener('console_debug', console, arguments);
            };
        }
        
        /** Console: trace */
        if (cloudpelican.config.listeners.console_trace === true) {
            cloudpelican._oldListeners['console_trace'] = console.trace;
            console.trace = function() {
                /** Forward to our log */
                try {
                    var msg = arguments[0];
                    cloudpelican.log(msg, false); /** Message */
                } catch (e) {
                    /** Make sure no matter what happens in the CloudPelican log we continue the regular console output */
                }
                
                /** Run existing handles */
                return cloudpelican._applyOldListener('console_trace', console, arguments);
            };
        }
        
        /** Done */
        return true;
    },
        
    /**
     * Log message
     * @param {string} msg
     * @param {boolean} isError
     * @param {Object} additionalFields
     * @returns {boolean}
     */
    log : function(msg, isError, additionalFields) {
        /** Basic validation */
        if (typeof msg === 'undefined' || msg === null || msg.length === 0) {
            return false;
        }
        
        /** Basic message and auto populate host and time */
        var fields = {};
        fields['msg'] = msg;
        fields['host'] = this._getHost();
        fields['dt'] = this._getTime();
        
        /** Error message? */
        if (typeof isError !== 'undefined' && isError === true) {
            fields['error'] = '1';
        }
        
        /** Additional fields */
        if (typeof additionalFields !== 'undefined' && additionalFields !== null) {
            for (var attrname in additionalFields) {
                fields[attrname] = additionalFields[attrname];
            }
        }
        
        /** Generate a payload */
        var payload = {
            fields : fields
        };
        
        /** Write */
        this._write(payload);
        
        /** OK */
        return true;
    },
            
    /**
    * Get time (milliseconds)
    * @type {string}
    */
    _getTime : function() {
        return Math.round(new Date());
    },
    
    /**
     * Get host
     * @type {string}
     */
    _host : null,
    _getHost : function() {
        if (this._host === null) {
            this._host = document.location.host.toString();
        }
        return this._host;
    },
            
    _writeStack : [], /** Placeholder for messages until actual flush */
    _writeTimeout : null, /** Timeout holder */
    _writeSequence : 0, /** Counter of writes */
    _domReady : false, /** Is the dom ready? */
    
    /** 
     * Async writing
     * @param {Object} payload
     * @returns {boolean}
     */
    _write : function(payload) {
        /** Put on the write stack */
        this._writeStack.push(payload);
        
        /** Schedule backend write? */
        if (this._writeTimeout === null) {
            /** Prepare function */
            var req = function() {
                /** Copy & clear stack and timer */
                var currentStack = cloudpelican._writeStack;
                cloudpelican._writeStack = [];
                cloudpelican._writeTimeout = null;
                cloudpelican._writeSequence++;
                
                /** Assemble url */
                var subEndpoint = currentStack.length === 1 ? 'single' : 'bulk';
                var url = cloudpelican.config.endpoint + subEndpoint + '?js=1&t=' + encodeURIComponent(cloudpelican.config.token);
                for (i in currentStack) {
                    payload = currentStack[i];
                    for (k in payload.fields) {
                        val = payload.fields[k];
                        url += '&f';
                        if (subEndpoint === 'bulk') {
                            url += '[' + i + ']';
                        }
                        url += '[' + encodeURIComponent(k) + ']=' + encodeURIComponent(val);
                    }
                }
                
                /** Execute url */
                var script = document.createElement('script');
                script.async = true;
                script.defer = true;
                script.id = 'cloudpelican_' + cloudpelican._writeSequence;
                script.src = url;
                script.onload = function(e) {
                    /** Cleanup DOM */
                    document.body.removeChild(this);
                };
                
                /** Append to DOM, executing the URL in a self contained environment */
                document.body.appendChild(script);
            };
            
            /** Schedule */
            this._writeTimeout = setTimeout(req, this.config.write_interval_ms);
        }
        
        /** OK */
        return true;
    }
};
cloudpelican.init();

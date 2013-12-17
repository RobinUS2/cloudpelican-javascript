/**
 * CloudPelican javascript library
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
        write_interval_ms : 200
    },
        
    /**
     * Log message
     * @param {string} msg
     * @param {boolean} isError
     * @param {Object} additionalFieds
     * @returns {boolean}
     */
    log : function(msg, isError, additionalFields) {
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
        }
        
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
    
    /** 
     * Async writing
     * @param {Object} payload
     * @returns {boolean}
     */
    _writeStack : [], /** Placeholder for messages until actual flush */
    _writeTimeout : null, /** Timeout holder */
    _writeSequence : 0, /** Counter of writes */
    _domReady : false, /** Is the dom ready? */
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
                }
                
                /** Append to DOM, executing the URL in a self contained environment */
                document.body.appendChild(script);
            }
            
            /** Schedule */
            this._writeTimeout = setTimeout(req, this.config.write_interval_ms);
        }
        
        /** OK */
        return true;
    }
}

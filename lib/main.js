/*
 * THIS SOFTWARE IS PROVIDED ``AS IS'' AND ANY EXPRESSED OR IMPLIED
 * WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES
 * OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED.  IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY DIRECT,
 * INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
 * SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION)
 * HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT,
 * STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING
 * IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
 * POSSIBILITY OF SUCH DAMAGE.
 */

'use strict';

var crypto = require('crypto');
var async = require('async');
var deepMerge = require('deepmerge');
var pg = require('pg');

var LamassuConfig = module.exports = function (conString) {
  if (!conString) {
    throw new Error('Postgres connection string is required');
  }

  this.client = new pg.Client(conString);
  this.client.connect();
};

LamassuConfig.prototype._readConfig = function(configType, done) {
  var self = this;
  var sql = 'SELECT data FROM user_config';
  var sqlParams = [];
  if(configType)  {
    sql += ' WHERE type = $1';
    sqlParams.push(configType);
  }
  sql+= ' ORDER BY id';

  self.client.query({text: sql, values:sqlParams}, function(err, results){
    if (err) { return done(err); }

    var config = {};
    if (!results || results.rowCount === 0) {
      return done(new Error('No rows found in configuration table.'));
    }
    for(var i = 0; i < results.rows.length; i++) {
      config = deepMerge(config, JSON.parse(results.rows[i].data));
    }
    return done(null, {ok:true, config:config});
  });
};



LamassuConfig.prototype._updateConfig = function(configType, config, done) {
  var self = this;

  self.client.query({text:'UPDATE user_config SET data = $1  WHERE type = $2', values:[config, configType]}, function(err) {
    if(err)  {
      done(err, {ok:false, msg: 'Failed to save config.'});
    }
    else {
      done(null, {ok:true});
    }
  });
}



LamassuConfig.prototype.load = function(done) {
  this._readConfig(undefined, function(err, result) {
    if(err) { return done(err); }
    if(result.ok) {
      result.config.exchanges.settings.currency = result.config.brain.locale.currency;
      result.config.exchanges.settings.networkTimeout = result.config.brain.networkTimeout;
    }
    return done(null, result);
  });
};



LamassuConfig.prototype.readExchangesConfig = function(done) {
  this._readConfig('exchanges', done);
};



LamassuConfig.prototype.saveExchangesConfig = function(config, done) {
  this._updateConfig('exchanges', config, done);
};

LamassuConfig.prototype.end = function () {
  this.client.end();
};

LamassuConfig.prototype.isAuthorized = function(fingerprint, callback) {
  this.client.query({
    text: 'SELECT * FROM devices WHERE fingerprint = $1 AND authorized=true',
    values: [fingerprint]
  }, function(err, results) {
    if (err) return callback(err);
    callback(null, results.rows.length === 1);
  });
};

LamassuConfig.prototype.createPairingToken = function(callback) {
  var token = crypto.randomBytes(32).toString('hex');
  this.client.query({
    text: 'INSERT INTO pairing_tokens VALUES (DEFAULT, $1, $2)',
    values: [token, Date.now()]
  }, function(err) {
    if (err) return callback(err);
    callback(null, token);
  });
};

LamassuConfig.prototype.pair = function(token, fingerprint, name, callback) {
  var self = this;

  self.client.query({
    text: 'DELETE FROM pairing_tokens WHERE token=$1',
    values: [token]
  }, function(err, results) {
    if (err) return callback(err);

    if (results.rowCount === 1) {
      token = results.rows[0];

      self.client.query({
        text: 'INSERT INTO devices VALUES (DEFAULT, $1, $2, false)',
        values: [fingerprint, name]
      }, callback);
    }
    else {
      return callback(new Error('Token not found'));
    }
  });
};

LamassuConfig.prototype.authorize = function(fingerprint, callback) {
  this.client.query({
    text: 'UPDATE devices SET authorized=true WHERE fingerprint=$1',
    values: [fingerprint]
  }, callback);
};

LamassuConfig.prototype.deauthorize = function(fingerprint, callback) {
  this.client.query({
    text: 'DELETE FROM devices WHERE fingerprint = $1',
    values: [fingerprint]
  }, callback);
};

LamassuConfig.prototype.txLimit = function txLimit() {
  // TODO DEBUG FIX TEMP
  return null;
};

"use strict";

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

/*jshint esversion: 6 */

define(function (require) {
  // "use strict";

  function jSchema(attr) {
    attr = attr || {};
    var VERSION = "0.5.6";
    var data = [],
        counter = 0,
        _schema = {
      tables: {},
      length: 0,
      caseSensitive: attr.caseSensitive === undefined ? true : attr.caseSensitive
    };

    // Add a new table to your schema
    // @namespace jSchema
    // @method add
    // @param {Object} d - a dataset
    // @param {Object} md - metadata about the dataset (name, primaryKey)
    // TODO add a unique value to datasets
    _schema.add = function (d, metadata) {
      var _this = this;

      if ((typeof d === "undefined" ? "undefined" : _typeof(d)) != "object") {
        _log(1, d + " is not an object");
        return 0;
      }
      var name = metadata && metadata.name ? metadata.name.toUpperCase() : "TABLE" + counter++;
      if (_checkUnique(name, this.tables) === false) return 0;
      if (this.caseSensitive) d = _colToUppercase(d);

      this.tables[name] = {};
      this.tables[name].id = data.length;
      this.tables[name].pk = metadata && metadata.primaryKey ? metadata.primaryKey : null;
      if (this.caseSensitive && this.tables[name].pk) this.tables[name].pk = this.tables[name].pk.toUpperCase();
      this.tables[name].rows = d.length;
      this.tables[name].col = Object.keys(d[0]);
      this.tables[name].metadata = {};
      this.tables[name].col.forEach(function (c, i) {
        _this.tables[name].col[i] = c;
        _this.tables[name].metadata[c] = {
          "dataType": _typeof(d[0][c])
        };
      });
      data.push(d);
      this.length = data.length;
      return this;
    };

    // get a table
    // @namespace jSchema
    // @method get
    // @param {String} d - dataset name
    _schema.get = function (d) {
      if (this.caseSensitive) d = d.toUpperCase();
      if (_checkForTable(d, this.tables) === false) return;
      return data[this.tables[d].id];
    };

    // join two tables
    // @namespace jSchema
    // @method join
    // @param {String} d1 dataset
    // @param {String} d2 dataset
    _schema.join = function (d1, d2, attr) {
      var _this2 = this;

      attr = attr || {};
      if (this.caseSensitive) {
        d1 = d1.toUpperCase();
        d2 = d2.toUpperCase();
      }
      var target = [];
      if (_checkForTable(d1, this.tables) === false) return;
      if (_checkForTable(d2, this.tables) === false) return;
      data[this.tables[d1].id].forEach(function (left) {
        data[_this2.tables[d2].id].forEach(function (right) {
          if (left[_this2.tables[d1].pk] == right[_this2.tables[d1].pk]) {
            var dest = {};
            for (var attrname in left) {
              dest[d1 + "." + attrname] = left[attrname];
            }
            for (attrname in right) {
              dest[d2 + "." + attrname] = right[attrname];
            }
            target.push(dest);
          }
        });
      });
      this.add(target, {
        name: attr.name || "WORK." + d1 + "_" + d2
      });
      return this;
    };

    // drop a table
    // @namespace jSchema
    // @method drop
    // @param {String} d dataset
    _schema.drop = function (d) {
      if (this.caseSensitive) d = d.toUpperCase();
      if (_checkForTable(d, this.tables) === false) return;
      data.splice(this.tables[d].id, 1);
      for (var key in this.tables) {
        if (this.tables[key].id > this.tables[d].id) {
          this.tables[key].id -= 1;
        }
      }
      delete this.tables[d];
      this.length = data.length;
      return this;
    };

    // sort a table by value
    // @namespace jSchema
    // @method orderBy
    // @param {String} d dataset
    // @param {String} attr object containing the attribute to sort by & orderBy
    // e.g. {clause: "height, order: "des", name: "tableName"}
    _schema.orderBy = function (d, attr) {
      attr = attr || {};
      if (attr.clause === undefined) return 0;
      if (this.caseSensitive) {
        attr.clause = attr.clause.toUpperCase();
        d = d.toUpperCase();
      }
      if (_checkForTable(d, this.tables) === false) return;
      attr.order = attr.order !== undefined && attr.order.toUpperCase() == "ASC" ? "ASC" : "DESC";
      var orderByData = data[this.tables[d].id].sort(function (d1, d2) {
        return attr.order == "ASC" ? d1[attr.clause] - d2[attr.clause] : d2[attr.clause] - d1[attr.clause];
      });
      this.add(orderByData, {
        name: attr.name || "WORK." + d + "_" + attr.clause + "_" + attr.order,
        primaryKey: attr.clause
      });
      return this;
    };

    // group a table by dimension
    // @namespace jSchema
    // @method groupBy
    // @param {String} d dataset
    // @param {Object} attr dimension to group by and measure to aggregate
    // e.g. {dim: "height, metric: "count", name: "tableName"}
    _schema.groupBy = function (d, attr) {
      attr = attr || {};
      if (attr.dim === undefined || attr.metric === undefined) {
        _log(1, "Must include a dimension and metrics to group by");
        return 0;
      } else {
        attr.method = attr.method || "SUM";
        if (this.caseSensitive) {
          attr.dim = attr.dim.toUpperCase();
          attr.metric = attr.metric.toUpperCase();
          attr.method = attr.method.toUpperCase();
        }
      }
      var dataset = data[this.tables[d].id];
      var groupByData = _aggregate(dataset, attr.dim, attr.metric, attr.method, attr.percision, attr.dimName);
      if (groupByData == 0) return 0;
      this.add(groupByData, {
        name: attr.name || "WORK." + d + "_" + attr.dim + "_" + attr.metric,
        primaryKey: attr.name
      });
      return this;
    };

    // Filter a table by one or more predicates
    // @namespace jSchema
    // @method filter
    // @param {String} d dataset
    // @param {String} predicate
    // @param {String} expression
    // multiple pairs of predicates and expressions can be strung together
    _schema.filter = function (d, clauses) {
      if (this.caseSensitive) d = d.toUpperCase();
      if (arguments.length < 3 || arguments.length % 2 === 0) {
        _log(1, "Please include table, predicate, and expression");
        return 0;
      }
      var subsetData = data[this.tables[d].id];
      for (var i = 1; i < arguments.length; i += 2) {
        var predicate = arguments[i],
            expression = arguments[i + 1];
        if (this.caseSensitive) predicate = predicate.toUpperCase();
        subsetData = _filterPredicate(subsetData, predicate, expression);
      }
      this.add(subsetData, {
        name: "WORK." + d + "_" + arguments[1] + "_" + arguments[2]
      });
      return this;
    };

    // update a table with a new dataset
    // @namespace jSchema
    // @method update
    // @param {String} d dataset
    // @param {Object} data new dataset to replace d
    // TODO add in check for type, columns
    _schema.update = function (d, data) {
      if (this.caseSensitive) d = d.toUpperCase();
      if (_checkForTable(d, this.tables) === false) return;
      var pk = this.tables[d].pk;
      this.drop(d);
      this.add(data, {
        "name": d,
        "primaryKey": pk
      });
      return this;
    };

    _schema.insert = function (d, rows) {
      var _this3 = this;

      if (this.caseSensitive) d = d.toUpperCase();
      if (_checkForTable(d, this.tables) === false) return;
      if (!Array.isArray(rows)) rows = new Array(rows);
      if (this.caseSensitive) rows = _colToUppercase(rows);
      rows.forEach(function (r) {
        data[_this3.tables[d].id].push(r);
      });
      return this;
    };

    // Remove a column from a dataset
    // @namespace jSchema
    // @method removeCol
    // @param {String} d dataset
    // @param {Object} attributes
    _schema.removeCol = function (d, attr) {
      attr = attr || {};
      if (attr.col === undefined) {
        _log(1, "Must include a column name to remove");
        return 0;
      }
      attr.name = attr.name == undefined ? "WORK." + d + attr.col + "REMOVED" : attr.name;
      if (this.caseSensitive) {
        d = d.toUpperCase();
        attr.col = attr.col.toUpperCase();
        attr.name = attr.name.toUpperCase();
      }
      if (_checkForTable(d, this.tables) === false) return;
      var ds = JSON.parse(JSON.stringify(data[this.tables[d].id]));
      ds.forEach(function (r) {
        delete r[attr.col];
      });
      this.add(ds, {
        "name": attr.name,
        "primaryKey": this.tables[d].pkid
      });
      return this;
    };

    // add a column to a dataset
    // @namespace jSchema
    // @method addCol
    // @param {String} d dataset
    // @param {Object} attributes
    _schema.addCol = function (d, attr) {
      attr = attr || {};
      if (attr.expression === undefined || attr.colName === undefined) {
        _log(1, "Must include expression and name for new column");
      }
      attr.name = attr.name == undefined ? "WORK." + d + attr.colName + "_EXPRESSION" : attr.name;
      if (this.caseSensitive) {
        d = d.toUpperCase();
        attr.name = attr.name.toUpperCase();
        attr.colName = attr.colName.toUpperCase();
      }
      if (_checkForTable(d, this.tables) === false) return;
      var exp = _parseExpression(data[this.tables[d].id], attr.expression);
      var ds = JSON.parse(JSON.stringify(data[this.tables[d].id]));
      ds.forEach(function (c) {
        c[attr.colName] = mathHelpers[exp[1]](Number.parseFloat(c[exp[0]]), Number.parseFloat(c[exp[2]]));
      });
      this.add(ds, {
        "name": attr.name,
        "primaryKey": this.tables[d].pkid
      });
    };

    // clean up everything that is in the work namespace
    // @namespace jSchema
    // @method cleanUp
    _schema.cleanUp = function () {
      for (var key in this.tables) {
        if (key.indexOf("WORK.") > -1) {
          this.drop(key);
        }
      }
      return this;
    };
    console.log("jschema.js version " + VERSION + " loaded.");
    return _schema;
  }

  //*********** helper functions ********************

  // returns an array of distinct values
  function _distinct(d, v) {
    var unique = {};
    var arr = [];
    for (var i in d) {
      if (typeof unique[d[i][v]] == "undefined") {
        arr.push(d[i][v]);
      }
      unique[d[i][v]] = "";
    }
    return arr;
  }

  // verifies that a table name is unique in the schema
  function _checkUnique(d, a) {
    for (var key in a) {
      if (key == d) {
        _log(1, d + " already exists in schema");
        return false;
      }
    }
    return true;
  }

  // checks to ensure that a table exists in the schema
  function _checkForTable(d, a) {
    if (a[d] === undefined) {
      _log(1, d + " does not exist in schema.");
      return false;
    } else {
      return true;
    }
  }

  //filters a dataset based on a predicate and value
  function _filterPredicate(data, p, e) {
    var subset = data.filter(function (d) {
      return d[p] == e;
    });
    return subset;
  }

  //converts all columns to uppercase
  function _colToUppercase(d) {
    for (var i = 0; i < d.length; i++) {
      var a = d[i];
      for (var key in a) {
        var temp;
        if (a.hasOwnProperty(key)) {
          temp = a[key];
          delete a[key];
          a[key.toUpperCase()] = temp;
        }
      }
      d[i] = a;
    }
    return d;
  }

  // logging function
  function _log(c, t) {
    var log = ["INFO", "WARNING", "ERROR"],
        logLvl = 0;
    if (c > logLvl) console.log(log[c] + ": " + t);
  }

  function _parseExpression(d, e) {
    var expression = e.split(" ");
    if (["+", "-", "/", "*", "^", "%"].indexOf(expression[1]) == -1) return 0;
    if (d[0][expression[0]] == undefined || d[0][expression[2]] == undefined) return 0;
    return expression;
  }

  var mathHelpers = {
    "+": function _(x, y) {
      return x + y;
    },
    "-": function _(x, y) {
      return x - y;
    },
    "/": function _(x, y) {
      return x / y;
    },
    "*": function _(x, y) {
      return x * y;
    },
    "^": function _(x, y) {
      return x ^ y;
    },
    "%": function _(x, y) {
      return x % y;
    }
  };

  // method for aggregating datasets
  function _aggregate(dataset, dim, metric, method, percision, dimName) {
    var uniqueDimensions = _distinct(dataset, dim);
    var groupByData = [];
    method = method || "SUM";
    if (["SUM", "COUNT", "AVERAGE", "MIN", "MAX"].indexOf(method) == -1) return 0;
    uniqueDimensions.forEach(function (uniqueDim) {
      var filterDataset = dataset.filter(function (d) {
        return d[dim] == uniqueDim;
      });
      var reducedDataset = aggregateHelpers[method.toLowerCase()](uniqueDim, filterDataset, metric, dimName || dim);
      reducedDataset.val = reducedDataset.val.toFixed(percision || 2);
      groupByData.push(reducedDataset);
    });
    return groupByData;
  }

  var aggregateHelpers = {
    // method for summing values
    sum: function sum(dim, ds, metric, dName) {
      return ds.reduce(function (a, b) {
        var _ref;

        return _ref = {}, _defineProperty(_ref, dName, dim), _defineProperty(_ref, "val", a.val + b[metric]), _ref;
      }, {
        val: 0
      });
    },
    // method for counting values
    count: function count(dim, ds, metric, dName) {
      return ds.reduce(function (a, b) {
        var _ref2;

        return _ref2 = {}, _defineProperty(_ref2, dName, dim), _defineProperty(_ref2, "val", a.val + 1), _ref2;
      }, {
        val: 0
      });
    },
    // method for averages
    average: function average(dim, ds, metric, dName) {
      var reducedDS = ds.reduce(function (a, b) {
        var _ref3;

        return _ref3 = {}, _defineProperty(_ref3, dName, dim), _defineProperty(_ref3, "sum", a.sum + b[metric]), _defineProperty(_ref3, "count", a.count + 1), _ref3;
      }, {
        sum: 0,
        count: 0
      });
      reducedDS.val = reducedDS.sum / reducedDS.count;
      delete reducedDS.sum;
      delete reducedDS.count;
      return reducedDS;
    },

    // method for maximum values
    max: function max(dim, ds, metric, dName) {
      return ds.reduce(function (a, b) {
        var _ref4;

        return _ref4 = {}, _defineProperty(_ref4, dName, dim), _defineProperty(_ref4, "val", a.val > b[metric] ? a.val : b[metric]), _ref4;
      }, {
        val: 0
      });
    },

    // method for minimum values
    min: function min(dim, ds, metric, dName) {
      return ds.reduce(function (a, b) {
        var _ref5;

        return _ref5 = {}, _defineProperty(_ref5, dName, dim), _defineProperty(_ref5, "val", a.val === 0 || a.val < b[metric] ? a.val : b[metric]), _ref5;
      }, {
        val: Number.MAX_SAFE_INTEGER
      });
    }
  };
  return jSchema;
});
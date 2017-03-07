(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define(["require", "exports", "./sentinel", "./json-graph", "chai"], factory);
    }
})(function (require, exports) {
    "use strict";
    var sentinel_1 = require("./sentinel");
    var json_graph_1 = require("./json-graph");
    var chai_1 = require("chai");
    describe('JsonGraph', function () {
        describe('set', function () {
            it('should work with ref sentinel values', function () {
                var g = new json_graph_1.JsonGraph();
                g.set(['dataById'], {
                    '1': 'two',
                    '3': {
                        'apple': 'bees',
                        'knees': 'sneeze'
                    }
                });
                g.set(['users', 4, 'data'], sentinel_1.ref(['dataById', '3']));
                var data = g.__data;
                chai_1.expect(data).to.deep.equal({
                    dataById: {
                        '1': 'two',
                        '3': {
                            'apple': 'bees',
                            'knees': 'sneeze'
                        }
                    },
                    users: {
                        4: {
                            data: { $type: 'ref', value: ['dataById', '3'] }
                        }
                    }
                });
                g.set(['users', 4, 'data', 'apple'], 'bananna');
                var data2 = g.__data;
                chai_1.expect(data2.dataById['3'].apple).to.equal('bananna');
            });
            it('should allow values to be set on the root.', function () {
                var g = new json_graph_1.JsonGraph();
                g.set([], {
                    foo: {
                        bar: 'baz'
                    }
                });
                chai_1.expect(g.__data).to.deep.equal({
                    foo: {
                        bar: 'baz'
                    }
                });
            });
            it('should allow deep recursion of references.', function () {
                var g = new json_graph_1.JsonGraph();
                g.set([], {
                    foo: {
                        bar: sentinel_1.ref(['foo', 'baz']),
                        baz: sentinel_1.ref(['foo', 'buzz']),
                        buzz: sentinel_1.ref(['foo', 'bing']),
                        bing: sentinel_1.ref(['blang', 'bling'])
                    },
                    blang: {
                        bling: 'zing'
                    }
                });
                g.set(['foo', 'bar'], 'bananna');
                chai_1.expect(g.__data.blang.bling).to.equal('bananna');
            });
        });
        describe('getSync', function () {
            it('should work with ref sentinel values', function () {
                var g = new json_graph_1.JsonGraph();
                g.set([], {
                    dataById: {
                        '1': 'two',
                        '3': {
                            'apple': 'bees',
                            'knees': 'sneeze'
                        }
                    },
                    users: {
                        4: {
                            data: sentinel_1.ref(['dataById', '3'])
                        }
                    }
                });
                var data = g.getSync(['users', 4, 'data']);
                chai_1.expect(data).to.deep.equal({
                    'apple': 'bees',
                    'knees': 'sneeze'
                });
                var bees = g.getSync(['users', 4, 'data', 'apple']);
                chai_1.expect(bees).to.equal('bees');
            });
        });
    });
});
//# sourceMappingURL=json-graph.spec.js.map
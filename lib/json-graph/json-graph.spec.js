(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define(["require", "exports", "./sentinel", "./json-graph", "chai", "sinon"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var sentinel_1 = require("./sentinel");
    var json_graph_1 = require("./json-graph");
    var chai_1 = require("chai");
    var sinon = require("sinon");
    describe('JsonGraph', function () {
        describe('set', function () {
            it('should work with POJOs', function () {
                var g = new json_graph_1.JsonGraph();
                var value = {
                    something: {
                        cool: ['is here!']
                    },
                    anythingElse: [
                        {
                            value: 'You\'d like to mention?'
                        }
                    ]
                };
                g.set([], value);
                var val = g.getSync([]);
                chai_1.expect(val).to.deep.equal(value);
            });
            it('should work with ref sentinel values', function () {
                var g = new json_graph_1.JsonGraph('');
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
                var g = new json_graph_1.JsonGraph('');
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
                var g = new json_graph_1.JsonGraph('');
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
                var g = new json_graph_1.JsonGraph('');
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
            it('should allow the definition of an "undefined" value', function () {
                var g = new json_graph_1.JsonGraph();
                g.set([1], 'four');
                var five = g.getSync([2], 'five');
                chai_1.expect(five).to.equal('five');
            });
            it('should retrieve the undefined value when expired references have been traversed', function () {
                var g = new json_graph_1.JsonGraph('');
                sinon.stub(g, 'dateNow', function () {
                    return 2000;
                });
                var dateNow = g.dateNow();
                chai_1.expect(dateNow).to.equal(2000);
                g.set([], {
                    dataById: {
                        '1': 'two',
                        '3': {
                            'apple': 'bees',
                            'knees': 'sneeze'
                        }
                    },
                    users: {
                        4: sentinel_1.ref(['dataById', '3'], { $expires: 1000 }),
                        5: sentinel_1.ref(['dataById', '3'], { $expires: 3200 })
                    }
                });
                var nope = g.getSync(['users', 4], 'nope');
                chai_1.expect(nope).to.equal('nope');
                var niceTry = g.getSync(['users', 4, 'apple'], 'niceTry');
                chai_1.expect(niceTry).to.equal('niceTry');
                var bees = g.getSync(['users', 5, 'apple']);
                chai_1.expect(bees).to.equal('bees');
            });
            it('should unwrap atoms', function () {
                var g = new json_graph_1.JsonGraph();
                g.set([1], {
                    $type: 'atom',
                    value: 'teh'
                });
                var teh = g.getSync([1]);
                chai_1.expect(teh).to.equal('teh');
            });
            it('should not unwrap expired atoms', function () {
                var g = new json_graph_1.JsonGraph();
                g.set([1], {
                    $type: 'atom',
                    $expires: 0,
                    value: 'teh'
                });
                var teh = g.getSync([1]);
                chai_1.expect(teh).to.equal(undefined);
            });
            it('should not unwrap expired atoms with a non-zero timestamp', function () {
                var g = new json_graph_1.JsonGraph();
                g.set([1], {
                    $type: 'atom',
                    $expires: 1000,
                    value: 'teh'
                });
                sinon.stub(g, 'dateNow', function () {
                    return 2000;
                });
                var dateNow = g.dateNow();
                chai_1.expect(dateNow).to.equal(2000);
                var teh = g.getSync([1]);
                chai_1.expect(teh).to.equal(undefined);
            });
        });
        describe('has', function () {
            it('should return true if a path exists', function () {
                var g = new json_graph_1.JsonGraph('');
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
                var exists = g.has(['users', 4, 'data']);
                chai_1.expect(exists).to.equal(true);
            });
            it('should return false if a path does not exist', function () {
                var g = new json_graph_1.JsonGraph('');
                g.set([], {
                    cool: 'beans!'
                });
                var exists = g.has(['derpyderpydoo']);
                chai_1.expect(exists).to.equal(false);
            });
        });
    });
});
//# sourceMappingURL=json-graph.spec.js.map
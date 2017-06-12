"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
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
        it('should return undefined for unassigned values', function () {
            var g = new json_graph_1.JsonGraph();
            var value = g.getSync([]);
            chai_1.expect(value).to.equal(undefined);
            value = g.getSync(['D', 3, 3, '3']);
            chai_1.expect(value).to.equal(undefined);
        });
    });
    describe('delete', function () {
        it('should delete values', function () {
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
            g.delete(['dataById', 1]);
            var value = g.getSync(['dataById', 1]);
            chai_1.expect(value).to.equal(undefined);
            g.delete(['users', 4, 'data']);
            value = g.getSync(['dataById', 3]);
            chai_1.expect(value).to.equal(undefined);
        });
    });
    describe('observe', function () {
        var observeValues = function (valueStore) {
            return function (value) { return valueStore.push(value); };
        };
        it('should emit changes when the value in the path changes', function () {
            var g = new json_graph_1.JsonGraph();
            g.set([], {
                A: [0, 'hi']
            });
            var emitted = [];
            g.observe(['A', 1]).subscribe(observeValues(emitted));
            g.set(['A', 1], 'bye');
            g.set(['A', 1], 'in the sky');
            g.set(['A', 1], 'I\'m a monkey');
            chai_1.expect(emitted.length).to.equal(4);
            chai_1.expect(emitted[0].value).to.equal('hi');
            chai_1.expect(emitted[1].value).to.equal('bye');
            chai_1.expect(emitted[2].value).to.equal('in the sky');
            chai_1.expect(emitted[3].value).to.equal('I\'m a monkey');
        });
        it('should track changes across references', function () {
            var g = new json_graph_1.JsonGraph();
            g.set([], {
                A: [0, 'hi'],
                B: {
                    $type: 'ref',
                    value: ['A', 0]
                }
            });
            var emitted = [];
            g.observe(['B']).subscribe(observeValues(emitted));
            g.set(['A', 0], 'bye');
            g.set(['A', 0], 'in the sky');
            g.set(['A', 0], 'I\'m a monkey');
            chai_1.expect(emitted.length).to.equal(4);
            chai_1.expect(emitted[0].value).to.equal(0);
            chai_1.expect(emitted[1].value).to.equal('bye');
            chai_1.expect(emitted[2].value).to.equal('in the sky');
            chai_1.expect(emitted[3].value).to.equal('I\'m a monkey');
        });
        it('should track changes when references change', function () {
            var g = new json_graph_1.JsonGraph();
            g.set([], {
                D: 'bye',
                E: 'in the sky',
                F: 'I\'m a monkey',
                B: 'init'
            });
            var emitted = [];
            g.observe(['B']).subscribe(observeValues(emitted));
            g.set(['B'], { $type: 'ref', value: ['D'] });
            g.set(['B'], { $type: 'ref', value: ['E'] });
            g.set(['B'], { $type: 'ref', value: ['F'] });
            var valueOfB = g.getSync(['B']);
            chai_1.expect(valueOfB).to.equal('I\'m a monkey');
            chai_1.expect(emitted.length).to.equal(4);
            chai_1.expect(emitted[0].value).to.equal('init');
            chai_1.expect(emitted[1].value).to.equal('bye');
            chai_1.expect(emitted[2].value).to.equal('in the sky');
            chai_1.expect(emitted[3].value).to.equal('I\'m a monkey');
        });
        it('should emit undefined when a value is deleted.', function () {
            var g = new json_graph_1.JsonGraph();
            g.set([], {
                D: 'bye',
                E: 'in the sky',
                F: 'I\'m a monkey',
                B: 'init'
            });
            var emitted = [];
            g.observe(['B']).subscribe(observeValues(emitted));
            g.set(['B'], { $type: 'ref', value: ['D'] });
            g.set(['B'], { $type: 'ref', value: ['E'] });
            g.set(['B'], { $type: 'ref', value: ['F'] });
            g.delete(['B']);
            chai_1.expect(emitted.length).to.equal(5);
            chai_1.expect(emitted[0].value).to.equal('init');
            chai_1.expect(emitted[1].value).to.equal('bye');
            chai_1.expect(emitted[2].value).to.equal('in the sky');
            chai_1.expect(emitted[3].value).to.equal('I\'m a monkey');
            chai_1.expect(emitted[4].value).to.equal(undefined);
        });
    });
});
//# sourceMappingURL=json-graph.spec.js.map
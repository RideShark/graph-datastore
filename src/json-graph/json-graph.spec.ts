import { ref } from './sentinel';
import { JsonGraph } from './json-graph';
import mocha = require('mocha');
import {
    expect
} from 'chai';

import sinon = require('sinon');


describe('JsonGraph', () => {

    describe('set', () => {

        it('should work with POJOs', ()=>{
            let g = new JsonGraph();
            const value = {
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

            let val = g.getSync([]);

            expect(val).to.deep.equal(value);

        })

        it('should work with ref sentinel values', () => {

            let g = new JsonGraph();

            g.set(['dataById'], {
                '1': 'two',
                '3': {
                    'apple': 'bees',
                    'knees': 'sneeze'
                }
            });

            g.set(['users', 4, 'data'], ref(['dataById', '3']));

            let data = g.__data;

            expect(data).to.deep.equal({
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

            let data2 = g.__data;

            expect(data2.dataById['3'].apple).to.equal('bananna');
        });


        it('should allow values to be set on the root.', () => {

            let g = new JsonGraph();

            g.set([], {
                foo: {
                    bar: 'baz'
                }
            });

            expect(g.__data).to.deep.equal({
                foo: {
                    bar: 'baz'
                }
            });
        });


        it('should allow deep recursion of references.', () => {

            let g = new JsonGraph();

            g.set([], {
                foo: {
                    bar: ref(['foo', 'baz']),
                    baz: ref(['foo', 'buzz']),
                    buzz: ref(['foo', 'bing']),
                    bing: ref(['blang', 'bling'])
                },
                blang: {
                    bling: 'zing'
                }
            });

            g.set(['foo', 'bar'], 'bananna');

            expect(g.__data.blang.bling).to.equal('bananna');
        });


    });

    describe('getSync', () => {


        it('should work with ref sentinel values', () => {

            let g = new JsonGraph();

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
                        data: ref(['dataById', '3'])
                    }
                }
            });

            let data = g.getSync(['users', 4, 'data']);
            expect(data).to.deep.equal({
                'apple': 'bees',
                'knees': 'sneeze'
            });

            let bees = g.getSync(['users', 4, 'data', 'apple']);
            expect(bees).to.equal('bees');
        });


        it('should allow the definition of an "undefined" value', () => {

            let g = new JsonGraph();

            g.set([1], 'four');

            let five = g.getSync([2], {defaultValue: 'five'});
            expect(five).to.equal('five');
        });

        it('should retrieve the undefined value when expired references have been traversed', () => {

            let g = new JsonGraph('');

            sinon.stub(g, 'dateNow', function () {
                return 2000;
            });
            let dateNow = g.dateNow();
            expect(dateNow).to.equal(2000);

            g.set([], {
                dataById: {
                    '1': 'two',
                    '3': {
                        'apple': 'bees',
                        'knees': 'sneeze'
                    }
                },
                users: {
                    4: ref(['dataById', '3'], { $expires: 1000 }),
                    5: ref(['dataById', '3'], { $expires: 3200 })
                }
            });

            let nope = g.getSync(['users', 4], {defaultValue: 'nope'});

            expect(nope).to.equal('nope');

            let niceTry = g.getSync(['users', 4, 'apple'],{defaultValue:  'niceTry'});
            expect(niceTry).to.equal('niceTry');

            let bees = g.getSync(['users', 5, 'apple']);
            expect(bees).to.equal('bees');
        });

        it('should unwrap atoms', () => {

            let g = new JsonGraph();

            g.set([1], {
                $type: 'atom',
                value: 'teh'
            });

            let teh = g.getSync([1]);
            expect(teh).to.equal('teh');
        });

        it('should not unwrap expired atoms', () => {

            let g = new JsonGraph();

            g.set([1], {
                $type: 'atom',
                $expires: 0,
                value: 'teh'
            });

            let teh = g.getSync([1]);
            expect(teh).to.equal(undefined);
        });

        it('should not unwrap expired atoms with a non-zero timestamp', () => {

            let g = new JsonGraph();

            g.set([1], {
                $type: 'atom',
                $expires: 1000,
                value: 'teh'
            });

            sinon.stub(g, 'dateNow', function () {
                return 2000;
            });
            let dateNow = g.dateNow();
            expect(dateNow).to.equal(2000);

            let teh = g.getSync([1]);
            expect(teh).to.equal(undefined);
        });


        it('should return undefined for unassigned values', () => {
            
            let g = new JsonGraph();

            let value = g.getSync(['A']);
            expect(value).to.equal(undefined);

            value = g.getSync(['D', 3, 3, '3']);

            expect(value).to.equal(undefined);
        });

    });

    describe('delete', () => {

        it('should delete values', () => {
            
            let g = new JsonGraph();

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
                        data: ref(['dataById', '3'])
                    }
                }
            });

            g.delete(['dataById', 1]);

            let value = g.getSync(['dataById', 1]);
            expect(value).to.equal(undefined);

            g.delete(['users', 4, 'data']);
            value = g.getSync(['dataById', 3]);

            expect(value).to.equal(undefined);
        });
    });

    describe('observe', () => {

        const observeValues = (valueStore: any[]) => {
            return (value: any) => valueStore.push(value);
        };

        it('should emit changes when the value in the path changes', () => {

            let g = new JsonGraph();
            g.set([], {
                A: [0, 'hi']
            });
            let emitted = [];
            g.observe(['A', 1]).subscribe(observeValues(emitted));

            g.set(['A', 1], 'bye');
            g.set(['A', 1], 'in the sky');
            g.set(['A', 1], 'I\'m a monkey');

            expect(emitted.length).to.equal(4);
            expect(emitted[0].value).to.equal('hi');
            expect(emitted[1].value).to.equal('bye');
            expect(emitted[2].value).to.equal('in the sky');
            expect(emitted[3].value).to.equal('I\'m a monkey');
        });

        it('should track changes across references', () => {

            let g = new JsonGraph();
            g.set([], {
                A: [0, 'hi'],
                B: {
                    $type: 'ref',
                    value: ['A', 0]
                }
            });
            let emitted = [];
            g.observe(['B']).subscribe(observeValues(emitted));

            g.set(['A', 0], 'bye');
            g.set(['A', 0], 'in the sky');
            g.set(['A', 0], 'I\'m a monkey');

            expect(emitted.length).to.equal(4);
            expect(emitted[0].value).to.equal(0);
            expect(emitted[1].value).to.equal('bye');
            expect(emitted[2].value).to.equal('in the sky');
            expect(emitted[3].value).to.equal('I\'m a monkey');
        });


        it('should track changes when references change', () => {

            let g = new JsonGraph();
            g.set([], {
                D: 'bye',
                E: 'in the sky',
                F: 'I\'m a monkey',
                B: 'init'
            });
            let emitted = [];
            g.observe(['B']).subscribe(observeValues(emitted));

            g.set(['B'], { $type: 'ref', value: ['D'] });
            g.set(['B'], { $type: 'ref', value: ['E'] });
            g.set(['B'], { $type: 'ref', value: ['F'] });

            let valueOfB = g.getSync(['B']);
            expect(valueOfB).to.equal('I\'m a monkey');

            expect(emitted.length).to.equal(4);
            expect(emitted[0].value).to.equal('init');
            expect(emitted[1].value).to.equal('bye');
            expect(emitted[2].value).to.equal('in the sky');
            expect(emitted[3].value).to.equal('I\'m a monkey');
        });

        it('should emit undefined when a value is deleted.', () => {

            let g = new JsonGraph();
            g.set([], {
                D: 'bye',
                E: 'in the sky',
                F: 'I\'m a monkey',
                B: 'init'
            });
            let emitted = [];
            g.observe(['B']).subscribe(observeValues(emitted));

            g.set(['B'], { $type: 'ref', value: ['D'] });
            g.set(['B'], { $type: 'ref', value: ['E'] });
            g.set(['B'], { $type: 'ref', value: ['F'] });

            g.delete(['B']);

            expect(emitted.length).to.equal(5);
            expect(emitted[0].value).to.equal('init');
            expect(emitted[1].value).to.equal('bye');
            expect(emitted[2].value).to.equal('in the sky');
            expect(emitted[3].value).to.equal('I\'m a monkey');
            expect(emitted[4].value).to.equal(undefined);
        });
    });


    describe('has', () => {

        it('should return true if a path exists', () => {

            let g = new JsonGraph('');

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
                        data: ref(['dataById', '3'])
                    }
                }
            });

            let exists = g.has(['users', 4, 'data']);
            expect(exists).to.equal(true);

        });

        it('should return false if a path does not exist', () => {


            let g = new JsonGraph('');

            g.set([], {
                cool: 'beans!'
            });

            let exists = g.has(['derpyderpydoo']);
            expect(exists).to.equal(false);
        });
    });
});
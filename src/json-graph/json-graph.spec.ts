import { ref } from './sentinel';
import { JsonGraph } from './json-graph';
import mocha = require('mocha');
import {
    expect
} from 'chai';


describe('JsonGraph', ()=>{

    describe('set', ()=>{

        
        it('should work with ref sentinel values', ()=>{

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
                        data: {$type: 'ref', value: ['dataById', '3'] }
                    }
                }
            });

            g.set(['users', 4, 'data', 'apple'], 'bananna');

            let data2 = g.__data;

            expect(data2.dataById['3'].apple).to.equal('bananna');
        });

        
        it('should allow values to be set on the root.', ()=>{

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

        
        it('should allow deep recursion of references.', ()=>{

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

    describe('getSync', ()=>{

        
        it('should work with ref sentinel values', ()=>{

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


    });

});
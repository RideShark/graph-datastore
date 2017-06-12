import { GraphDatastore } from './graph-datastore';
import mocha = require('mocha');
import { ref } from './json-graph/sentinel';
import {
    expect
} from 'chai';


interface Trip {
    id: string;
    name: string;
    driver: User;
    comments: string;
    reservations: TripReservation[];
}

interface TripReservation {
    id: string;
    trip: Trip;
    comments: string;
    reservedBy: User;
}

interface User {
    id: string;
    firstName: string;
    lastName: string;
}


describe('GraphDatastore', () => {

    let datastore: GraphDatastore;

    const configureDatastore = () => {
        datastore = new GraphDatastore();

        datastore.addGraphType<Trip>(
            'Trip',
            ['id'],
            ['name', 'comments'],
            {
                driver: {
                    $typeName: 'User',
                    $isSingular: true
                },
                reservations: {
                    $typeName: 'TripReservation',
                    $isArray: true
                }
            });

        datastore.addGraphType<TripReservation>(
            'TripReservation',
            ['id'],
            ['comments'],
            {
                reservedBy: {
                    $typeName: 'User',
                    $isSingular: true
                }
            });

        datastore.addGraphType<User>(
            'User',
            ['id'],
            ['firstName', 'lastName'],
            {});

        datastore.set<Trip>('Trip', [
            {
                id: '1',
                name: 'A to B',
                driver: {
                    id: '235',
                    firstName: 'Tom',
                    lastName: 'Driver'
                },
                comments: 'I like to drive',
                reservations: [
                    {
                        id: '24',
                        trip: ref(['Trip', '1']) as any,
                        comments: 'I like to be driven',
                        reservedBy: {
                            id: '312512',
                            firstName: 'John',
                            lastName: 'Reynolds'
                        }
                    },
                    {
                        id: '25',
                        trip: ref(['Trip', '1']) as any,
                        comments: 'I like to be droven',
                        reservedBy: {
                            id: '312531222',
                            firstName: 'Ann',
                            lastName: 'Reynolds'
                        }
                    }
                ]
            }
        ]);
    }

    describe('De-nesting of types', () => {


        beforeEach(() => {
            configureDatastore();
        });

        it('should dereference nested types', () => {

            let johnReynolds = datastore.getSync<User>('User', '312512');

            expect(johnReynolds.firstName).to.equal('John');
            expect(johnReynolds.lastName).to.equal('Reynolds');
            expect(johnReynolds.id).to.equal('312512')

            let tomDriver = datastore.getSync<User>('User', '235');

            expect(tomDriver.firstName).to.equal('Tom');
            expect(tomDriver.lastName).to.equal('Driver');
            expect(tomDriver.id).to.equal('235');

            let johnsReservation = datastore.getSync<TripReservation>('TripReservation', 24);

            expect(johnsReservation.id).to.equal('24');
            expect(johnsReservation.comments).to.equal('I like to be driven');
            expect(johnsReservation.reservedBy.id).to.equal('312512');
            expect(johnsReservation.reservedBy.firstName).to.equal('John');
            expect(johnsReservation.reservedBy.lastName).to.equal('Reynolds');

        });

        it('should comprehend deep nesting of types', () => {


            let johnsReservation = datastore.getSync<TripReservation>('TripReservation', 24);

            expect(johnsReservation.trip.reservations[0].trip.reservations[0].trip.reservations[0].trip.id).to.equal('1');
        });

        it('Should re-nest nested types when get is called', () => {

            let trip = datastore.getSync<Trip>('Trip', '1');

            let tomDriver = trip.driver
            expect(tomDriver.firstName).to.equal('Tom');
            expect(tomDriver.lastName).to.equal('Driver');
            expect(tomDriver.id).to.equal('235');

            let reservations = trip.reservations;

            expect(reservations.length).to.equal(2);
            expect(reservations[0].reservedBy.id).to.equal('312512');
            expect(reservations[1].reservedBy.id).to.equal('312531222');


        });

    });

    describe('Durability', () => {
        interface Foo {
            id: string;
            bar: Foo;
        }

        it('Should allow super deep recursion, without breaking', () => {
            let datastore = new GraphDatastore();

            datastore.addGraphType<Foo>('Foo', ['id'], [], {
                bar: {
                    $typeName: 'Foo',
                    $isSingular: true
                }
            });

            datastore.set<Foo>('Foo', [
                {
                    id: '1',
                    bar: ref(['Foo', '2']) as any
                },
                {
                    id: '2',
                    bar: ref(['Foo', '1']) as any
                }]);

            let foo1 = datastore.getSync<Foo>('Foo', 1);
            let foo2 = datastore.getSync<Foo>('Foo', 2);

            expect(foo1.bar.bar.bar.bar.bar.bar.bar.bar.bar.bar.bar.bar.bar.id).to.equal('2');
        })
    });

    describe('Patch', () => {
        
        beforeEach(() => {
            configureDatastore();
        });

        it('Should allow data to be partially modified', () => {
            
            datastore.patch<User>('User', [{
                id: '235',
                lastName: 'Reynolds'
            }]);

            let trip = datastore.getSync<Trip>('Trip', '1');

            expect(trip.driver.lastName).to.equal('Reynolds');
            expect(trip.driver.firstName).to.equal('Tom');

            datastore.patch<Trip>('Trip', [
                {
                    id:'1',
                    reservations: [
                        undefined,
                        undefined,
                        {
                            id: '28',
                            trip: ref(['Trip', '1']) as any,
                            comments: 'I like to be droven',
                            reservedBy: ref(['User','312531222'])
                        }
                    ]
                }
            ]);

            trip = datastore.getSync<Trip>('Trip', '1');

            expect(trip.reservations.length).to.equal(3);
            expect(trip.reservations[0].id).to.equal('24');
            expect(trip.reservations[2].id).to.equal('28');

            let reservation28 = datastore.getSync<TripReservation>('TripReservation', '28');
            expect(reservation28.reservedBy.id).to.equal('312531222');

        });
    });
});
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var graph_datastore_1 = require("./graph-datastore");
var sentinel_1 = require("./json-graph/sentinel");
var chai_1 = require("chai");
describe('GraphDatastore', function () {
    var datastore;
    var configureDatastore = function () {
        datastore = new graph_datastore_1.GraphDatastore();
        datastore.addGraphType('Trip', ['id'], ['name', 'comments'], {
            driver: {
                $typeName: 'User',
                $isSingular: true
            },
            reservations: {
                $typeName: 'TripReservation',
                $isArray: true
            }
        });
        datastore.addGraphType('TripReservation', ['id'], ['comments'], {
            reservedBy: {
                $typeName: 'User',
                $isSingular: true
            }
        });
        datastore.addGraphType('User', ['id'], ['firstName', 'lastName'], {});
        datastore.set('Trip', [
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
                        trip: sentinel_1.ref(['Trip', '1']),
                        comments: 'I like to be driven',
                        reservedBy: {
                            id: '312512',
                            firstName: 'John',
                            lastName: 'Reynolds'
                        }
                    },
                    {
                        id: '25',
                        trip: sentinel_1.ref(['Trip', '1']),
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
    };
    describe('De-nesting of types', function () {
        beforeEach(function () {
            configureDatastore();
        });
        it('should dereference nested types', function () {
            var johnReynolds = datastore.getSync('User', '312512');
            chai_1.expect(johnReynolds.firstName).to.equal('John');
            chai_1.expect(johnReynolds.lastName).to.equal('Reynolds');
            chai_1.expect(johnReynolds.id).to.equal('312512');
            var tomDriver = datastore.getSync('User', '235');
            chai_1.expect(tomDriver.firstName).to.equal('Tom');
            chai_1.expect(tomDriver.lastName).to.equal('Driver');
            chai_1.expect(tomDriver.id).to.equal('235');
            var johnsReservation = datastore.getSync('TripReservation', 24);
            chai_1.expect(johnsReservation.id).to.equal('24');
            chai_1.expect(johnsReservation.comments).to.equal('I like to be driven');
            chai_1.expect(johnsReservation.reservedBy.id).to.equal('312512');
            chai_1.expect(johnsReservation.reservedBy.firstName).to.equal('John');
            chai_1.expect(johnsReservation.reservedBy.lastName).to.equal('Reynolds');
        });
        it('should comprehend deep nesting of types', function () {
            var johnsReservation = datastore.getSync('TripReservation', 24);
            chai_1.expect(johnsReservation.trip.reservations[0].trip.reservations[0].trip.reservations[0].trip.id).to.equal('1');
        });
        it('Should re-nest nested types when get is called', function () {
            var trip = datastore.getSync('Trip', '1');
            var tomDriver = trip.driver;
            chai_1.expect(tomDriver.firstName).to.equal('Tom');
            chai_1.expect(tomDriver.lastName).to.equal('Driver');
            chai_1.expect(tomDriver.id).to.equal('235');
            var reservations = trip.reservations;
            chai_1.expect(reservations.length).to.equal(2);
            chai_1.expect(reservations[0].reservedBy.id).to.equal('312512');
            chai_1.expect(reservations[1].reservedBy.id).to.equal('312531222');
        });
    });
    describe('Durability', function () {
        it('Should allow super deep recursion, without breaking', function () {
            var datastore = new graph_datastore_1.GraphDatastore();
            datastore.addGraphType('Foo', ['id'], [], {
                bar: {
                    $typeName: 'Foo',
                    $isSingular: true
                }
            });
            datastore.set('Foo', [
                {
                    id: '1',
                    bar: sentinel_1.ref(['Foo', '2'])
                },
                {
                    id: '2',
                    bar: sentinel_1.ref(['Foo', '1'])
                }
            ]);
            var foo1 = datastore.getSync('Foo', 1);
            var foo2 = datastore.getSync('Foo', 2);
            chai_1.expect(foo1.bar.bar.bar.bar.bar.bar.bar.bar.bar.bar.bar.bar.bar.id).to.equal('2');
        });
    });
    describe('Patch', function () {
        beforeEach(function () {
            configureDatastore();
        });
        it('Should allow data to be partially modified', function () {
            datastore.patch('User', [{
                    id: '235',
                    lastName: 'Reynolds'
                }]);
            var trip = datastore.getSync('Trip', '1');
            chai_1.expect(trip.driver.lastName).to.equal('Reynolds');
            chai_1.expect(trip.driver.firstName).to.equal('Tom');
            datastore.patch('Trip', [
                {
                    id: '1',
                    reservations: [
                        undefined,
                        undefined,
                        {
                            id: '28',
                            trip: sentinel_1.ref(['Trip', '1']),
                            comments: 'I like to be droven',
                            reservedBy: sentinel_1.ref(['User', '312531222'])
                        }
                    ]
                }
            ]);
            trip = datastore.getSync('Trip', '1');
            chai_1.expect(trip.reservations.length).to.equal(3);
            chai_1.expect(trip.reservations[0].id).to.equal('24');
            chai_1.expect(trip.reservations[2].id).to.equal('28');
            var reservation28 = datastore.getSync('TripReservation', '28');
            chai_1.expect(reservation28.reservedBy.id).to.equal('312531222');
        });
    });
});
//# sourceMappingURL=graph-datastore.spec.js.map
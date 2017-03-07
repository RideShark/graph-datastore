(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define(["require", "exports"], factory);
    }
})(function (require, exports) {
    "use strict";
    describe('GraphDatastore', function () {
        it('should allow root definitions', function () {
        });
    });
});
//# sourceMappingURL=graph-datastore.spec.js.map
(function(window, angular, undefined) {

'use strict';

// define the module
var services = angular.module('app.services', []);

services.factory('Telemetry', ['$resource',
    function($resource) {
        return $resource(
            'http://data.bluerobotics.com/telemetry/:id',
            {id:'@id'},
            {
                'query': {
                    method: 'GET'
                }
            }
        );
    }
]);

services.factory('LiveTelemetry', ['$rootScope', '$interval', 'pollrate', 'Telemetry',
    function($rootScope, $interval, pollrate, Telemetry) {
        // state vars
        var promise;
        var items = [];

        // update function
        var update = function(mission) {
            var params = {
                sort: '-_date',
                limit: 1000,
                where: { mission: mission }
            };
            if(items.length > 0)
                params.where._date = { $gt: items[0]._date };

            // stupid angular removes $gt, so stringify it ahead of time
            params.where = JSON.stringify(params.where);

            Telemetry.query(params, function(data){
                items = data.items.concat(items);
                $rootScope.$broadcast('telemetry-update', data.items);
            });
        };

        // public functions
        return {
            init: function(mission){
                if(promise) $interval.cancel(promise);
                items = []; // must always be sorted from news to oldest

                // create initial request
                console.log('Initiating live telemetry polling for', mission);
                update(mission);

                // periodically poll for updates
                promise = $interval(function(){
                    update(mission);
                }, pollrate);
            },
            items: function(){
                return items;
            }
        };
    }
]);

})(window, window.angular);

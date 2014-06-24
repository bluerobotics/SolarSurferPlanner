(function(window, _, moment, Qty, undefined) {

'use strict';

// SolarSuferPlanner, BlueRobotics

// constructor
function Planner(options) {
    this.options = _.extend({}, _.clone(this.default_options), options);
}

// defaults
Planner.prototype.default_options = {
    debug: true,
    date_start: moment(),
    date_delta: moment.duration(1, 'hour'),
    date_max: moment().add(moment.duration(10, 'weeks')),
    loc_start: new google.maps.LatLng(33.8823163, -118.4123013),
    loc_end: new google.maps.LatLng(19.1205301, -155.5010251)
};

// this is used as the data template during each step
Planner.prototype.data_template = {
    step: 0,
    date: undefined,
};

// this is where the simulation results go
Planner.prototype.data = [];

// log to the logger
Planner.prototype.log = function(data) {
    if(this.options.debug) this.logger(data);
};

// console logger
Planner.prototype.logger = function(data) {
    console.log(data);
};

// chainable constructor
Planner.prototype.start = function() {
    // clear out the data
    this.data = [];

    // state vars
    var step, previous = {
        step: 0,
        date: this.options.date_start.clone(),
        loc: this.options.loc_start
    };

    // loop
    this.log('### Starting the sim...');
    while(previous === undefined || previous.date < this.options.date_max) {
        // calculate step
        step = this.calculateStep(previous);

        // save data
        this.data.push(step);
        previous = step;
    }
    this.log('### Sim complete!');
};

// allow another class to inherit from Planner
Planner.prototype.calculateStep = function(previous) {
    this.log('step');

    // create a new step container
    var data = _.clone(this.data_template);

    // build on the previous step
    data.step = previous.step + 1;
    data.date = previous.date.clone().add(this.options.date_delta);

    // do the actual sim logic
    this.calculateSolar(data, previous);
    this.calculateBattery(data, previous);
    this.calculateSea(data, previous);
    this.calculateDrag(data, previous);
    this.calculateThrust(data, previous);
    this.calculateMovement(data, previous);

    // return the result of this step
    return data;
};

// calculate available solar energy based on time of day and day of year
Planner.prototype.calculateSolar = function(data, previous) {
    // calculate the power output
    // TODO: actually use sun angle at the time of the year
    var sun_factor = (Math.sin((5/6)*(data.date.hours()-7)/Math.PI)*0.9+0.1);
    if ( sun_factor < 0 ) {
    	sun_factor = 0;
    }
    data.p_solar = new Qty(sun_factor*120+'W');
    data.v_solar = new Qty(sun_factor*14+'V'); // This is not accurate at all.
};

// calculate battery state based on previous state and solar state
Planner.prototype.calculateBattery = function(data, previous) {
    data.v_batt = data.v_solar;
};

// calculate the sea conditions based on historical record
Planner.prototype.calculateSea = function(data, previous) {
    // calculate a historic or random sea current from the JPL OSCAR database
    data.sea_current = {
        mag: new Qty('0.1 m/s'),
        dir: new Qty('-130 deg') // to the South
    };
};

// calculate drag based on sea state
Planner.prototype.calculateDrag = function(data, previous) {
};

// calculate thrust based on available battery power
Planner.prototype.calculateThrust = function(data, previous) {
	data.thrust = data.p_solar.div(new Qty('120.0 W')).mul(new Qty('26.7 N')); // Each thruster produces 3 lb at ~60 Watts
};

// calculate new position at the end of the step
Planner.prototype.calculateMovement = function(data, previous) {
    // force balance
    // var f = data.thrust - data.drag;

    // simple speed calc if battery power is good
    var v;
    if(data.p_solar.lt(new Qty('20 W'))) {
        // stormy seas?
        if(Math.random() > 0.9) {
            v = {
                mag: data.sea_current.mag.mul(10),
                dir: data.sea_current.dir
            };
        }
        else v = data.sea_current;
    }
    else {
        // For now we'll assume that 4.5 ft/s is our max speed at max power and the speed
        // drops off linearly with power. This isn't really true because drag is proportional
        // to the square of speed and thrust. It'll be close though.
        v = {
            mag: data.p_solar.div(new Qty('120.0 W')).mul(new Qty('4.5 ft/s')),
            dir: new Qty(google.maps.geometry.spherical.computeHeading(
                previous.loc,
                this.options.loc_end 
            )+'deg')
        };
    }

    // calculate a distance from the speed
    var dt = new Qty(this.options.date_delta.asMilliseconds()+'ms');
    var x = {
        mag: v.mag.mul(dt).to('m'),
        dir: v.dir
    };

    // calculate new latlng based on the distance and heading
    data.loc = google.maps.geometry.spherical.computeOffset(
        previous.loc,
        x.mag.scalar,
        x.dir.scalar
    );
    data.dx_home = new Qty(google.maps.geometry.spherical.computeDistanceBetween(
        this.options.loc_start,
        data.loc
    )+'m'); // probably in meters, API docs don't say
};

// export
window.SolarSuferPlanner = Planner;

})(window, window._, window.moment, window.Qty);

/* - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -  */
/* Geohash encoding/decoding and associated functions        (c) Chris Veness 2014 / MIT Licence  */
/* - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -  */

/* jshint node:true, bitwise:false *//* global define */
'use strict';


/**
 * Geohash encode, decode, bounds, neighbours.
 *
 * @namespace
 */
var Geohash = {};

/* (Geohash-specific) Base16 map */
Geohash.base16 = '0123456789abcdef';

Geohash.hexBinaryMap = {'0': '0000',
                        '1': '0001',
                        '2': '0010',
                        '3': '0011',
                        '4': '0100',
                        '5': '0101',
                        '6': '0110',
                        '7': '0111',
                        '8': '1000',
                        '9': '1001',
                        'a': '1010',
                        'b': '1011',
                        'c': '1100',
                        'd': '1101',
                        'e': '1110',
                        'f': '1111'}

Geohash.binaryHexMap = {'0000': '0',
                        '0001': '1',
                        '0010': '2',
                        '0011': '3',
                        '0100': '4',
                        '0101': '5',
                        '0110': '6',
                        '0111': '7',
                        '1000': '8',
                        '1001': '9',
                        '1010': 'a',
                        '1011': 'b',
                        '1100': 'c',
                        '1101': 'd',
                        '1110': 'e',
                        '1111': 'f'}

/**
 * Encodes latitude/longitude to geohash, either to specified precision or to automatically
 * evaluated precision.
 *
 * @param   {number} lat - Latitude in degrees.
 * @param   {number} lon - Longitude in degrees.
 * @param   {number} [precision] - Number of characters in resulting geohash.
 * @returns {string} Geohash of supplied latitude/longitude.
 * @throws  Invalid geohash.
 *
 * @example
 *     var geohash = Geohash.encode(52.205, 0.119, 7); // geohash: 'u120fxw'
 */
Geohash.encode = function(lat, lon, precision) {
    // infer precision?
    if (typeof precision == 'undefined') {
        // refine geohash until it matches precision of supplied lat/lon
        for (let p=1; p<=12; p++) {
            let hash = Geohash.encode(lat, lon, p);
            let posn = Geohash.decode(hash);
            if (posn.lat==lat && posn.lon==lon) return hash;
        }
        precision = 12; // set to maximum
    }

    lat = Number(lat);
    lon = Number(lon);
    precision = Number(precision);

    if (isNaN(lat) || isNaN(lon) || isNaN(precision)) throw new Error('Invalid geohash');

    let idx = 0; // index into base32 map
    let bit = 0; // each char holds 5 bits
    let evenBit = true;
    let geohash = '';

    let latMin =  6, latMax =  36;
    let lonMin = 68, lonMax = 98;

    while (geohash.length < precision) {
        if (evenBit) {
            // bisect E-W longitude
            let lonMid = (lonMin + lonMax) / 2;
            if (lon > lonMid) {
                idx = idx*2 + 1;
                lonMin = lonMid;
            } else {
                idx = idx*2;
                lonMax = lonMid;
            }
        } else {
            // bisect N-S latitude
            let latMid = (latMin + latMax) / 2;
            if (lat > latMid) {
                idx = idx*2 + 1;
                latMin = latMid;
            } else {
                idx = idx*2;
                latMax = latMid;
            }
        }
        evenBit = !evenBit;

        if (++bit == 4) {
            // 5 bits gives us a character: append it and start over
            geohash += Geohash.base16.charAt(idx);
            bit = 0;
            idx = 0;
        }
    }

    return geohash;
};


/**
 * Decode geohash to latitude/longitude (location is approximate centre of geohash cell,
 *     to reasonable precision).
 *
 * @param   {string} geohash - Geohash string to be converted to latitude/longitude.
 * @returns {{lat:number, lon:number}} (Center of) geohashed location.
 * @throws  Invalid geohash.
 *
 * @example
 *     var latlon = Geohash.decode('u120fxw'); // latlon: { lat: 52.205, lon: 0.1188 }
 */
Geohash.decode = function(geohash) {

    let bounds = Geohash.bounds(geohash); // <-- the hard work
    // now just determine the centre of the cell...

    let latMin = bounds.sw.lat, lonMin = bounds.sw.lon;
    let latMax = bounds.ne.lat, lonMax = bounds.ne.lon;

    // cell centre
    let lat = (latMin + latMax)/2;
    let lon = (lonMin + lonMax)/2;

    // round to close to centre without excessive precision: ⌊2-log10(Δ°)⌋ decimal places
    lat = lat.toFixed(Math.floor(2-Math.log(latMax-latMin)/Math.LN10));
    lon = lon.toFixed(Math.floor(2-Math.log(lonMax-lonMin)/Math.LN10));

    return { lat: Number(lat), lon: Number(lon)};
};

Geohash.binaryToHex = function(binaryString) {
    let s = ""
    for (let i = 0; i < binaryString.length; i = i+4) {
        let r = binaryString.substr(i, 4)
        s += Geohash.binaryHexMap[r]
    }
    return s
}

Geohash.hexToBinary = function(hexString) {
    let s = ""
    for (let i = 0; i < hexString.length; i++) {
        s += Geohash.hexBinaryMap[hexString.charAt(i)]
    }
    return s
}

Geohash.adjacent = function(geohash, direction) {
    let value = Geohash.hexToBinary(geohash)
    let lats = "";
    let lngs = "";
    for(let i = 0; i < value.length; i++) {
        if(i%2 == 0) {
            lngs += value.charAt(i);
        } else {
            lats += value.charAt(i);
        }
    }
    let lngNum = parseInt(lngs, 2);
    let latNum = parseInt(lats, 2);
    let leftLng = (lngNum - 1).toString(2);
    let rightLng = (lngNum + 1).toString(2);
    let upLat = (latNum + 1).toString(2);
    let downLat = (latNum - 1).toString(2);

    switch(direction) {
        case "n":
            return Geohash.binaryToHex(Geohash.interleave(lngs, upLat))
        case "e":
            return Geohash.binaryToHex(Geohash.interleave(rightLng, lats))
        case "w":
            return Geohash.binaryToHex(Geohash.interleave(leftLng, lats))
        case "s":
            return Geohash.binaryToHex(Geohash.interleave(lngs, downLat))
    }
}



/**
 * Returns SW/NE latitude/longitude bounds of specified geohash.
 *
 * @param   {string} geohash - Cell that bounds are required of.
 * @returns {{sw: {lat: number, lon: number}, ne: {lat: number, lon: number}}}
 * @throws  Invalid geohash.
 */
Geohash.bounds = function(geohash) {
    if (geohash.length === 0) throw new Error('Invalid geohash');

    geohash = geohash.toLowerCase();

    let evenBit = true;
    let latMin =  6, latMax =  36;
    let lonMin = 68, lonMax = 98;

    for (let i=0; i<geohash.length; i++) {
        let chr = geohash.charAt(i);
        let idx = Geohash.base16.indexOf(chr);
        if (idx == -1) throw new Error('Invalid geohash');

        for (let n=3; n>=0; n--) {
            let bitN = idx >> n & 1;
            if (evenBit) {
                // longitude
                let lonMid = (lonMin+lonMax) / 2;
                if (bitN == 1) {
                    lonMin = lonMid;
                } else {
                    lonMax = lonMid;
                }
            } else {
                // latitude
                let latMid = (latMin+latMax) / 2;
                if (bitN == 1) {
                    latMin = latMid;
                } else {
                    latMax = latMid;
                }
            }
            evenBit = !evenBit;
        }
    }

    let bounds = {
        sw: { lat: latMin, lon: lonMin },
        ne: { lat: latMax, lon: lonMax }
    };

    return bounds;
};


Geohash.leftpad = function(s, num) {
    let r = "";
    for(let i = 0; i < num; i++) {
        r += "0";
    }
    return r + s;
}

Geohash.interleave = function(lngs, lats) {
    if(lngs.length < lats.length) {
        lngs = Geohash.leftpad(lngs, lats.length - lngs.length);
    }
    if(lats.length < lngs.length) {
        lats = Geohash.leftpad(lats, lngs.length - lats.length);
    }
    let s = "";
    for(let i = 0; i < lngs.length; i++) {
        s += lngs.charAt(i);
        s += lats.charAt(i);
    }
    return s;
}

/**
 * Returns all 8 adjacent cells to specified geohash.
 *
 * @param   {string} geohash - Geohash neighbours are required of.
 * @returns {{n,ne,e,se,s,sw,w,nw: string}}
 * @throws  Invalid geohash.
 */
Geohash.neighbours = function(geohash) {
    return {
        'n':  Geohash.adjacent(geohash, 'n'),
        'ne': Geohash.adjacent(Geohash.adjacent(geohash, 'n'), 'e'),
        'e':  Geohash.adjacent(geohash, 'e'),
        'se': Geohash.adjacent(Geohash.adjacent(geohash, 's'), 'e'),
        's':  Geohash.adjacent(geohash, 's'),
        'sw': Geohash.adjacent(Geohash.adjacent(geohash, 's'), 'w'),
        'w':  Geohash.adjacent(geohash, 'w'),
        'nw': Geohash.adjacent(Geohash.adjacent(geohash, 'n'), 'w')
    };
};


/* - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -  */
if (typeof module != 'undefined' && module.exports) module.exports = Geohash; // CommonJS, node.js
if (typeof define == 'function' && define.amd) define([], function() { return Geohash; }); // AMD

/**
 * @license
 * Copyright (C) 2014 Kiyong Jung (mics@micsland.com)
 * Based on wicket-gmap3.js, by K. Arthur Endsley (kaendsle@mtu.edu)
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */
(function () {
  
  /**
   * @augments Wkt.Wkt The default CRS of coordinates.
   */
  Wkt.Wkt.prototype.CRS = olleh.maps.UTMK;

  /**
   * @augments Wkt.Wkt The number of segments used to approximate a circle.
   */
  Wkt.Wkt.prototype.numSeg = 32;



  ////////////////////////////////////////
  // Construct
  ////////////////////////////////////////

  function constructPath(c) {
    var i, l, arr = [];
    for (i = 0, l = c.length; i < l; i++) {
      arr.push(new this.CRS(c[i]));
    }
    return new olleh.maps.Path(arr);
  }

  function constructMultigeometry(fn, config) {
    var i, l, arr = [], c = this.components;
    config = config || {};

    for (i = 0, l = c.length; i < l; i++) {
      arr.push(fn.call(this, config, c[i]));
    }

    return arr;
  }

  Wkt.Wkt.prototype.construct = {

    /**
     * Creates the framework's equivalent point geometry object.
     * @param config {Object} An optional properties hash the object should use
     * @param component {Object} An optional component to build from
     * @return {olleh.maps.overlay.Marker}
     */
    point: function (config, component) {
      var c = component || this.components;

      config = config || {};
      config.position = new this.CRS(c[0]);

      return new olleh.maps.overlay.Marker(config);
    },

    /**
     * Creates the framework's equivalent linestring geometry object.
     * @param config {Object} An optional properties hash the object should use
     * @param component {Object} An optional component to build from
     * @return {olleh.maps.vector.Polyline}
     */
    linestring: function (config, component) {
      var c = component || this.components;

      config = config || {};
      config.path = constructPath.call(this, c);

      return new olleh.maps.vector.Polyline(config);
    },

    /**
     * Creates the framework's equivalent Box or Rectangle geometry object.
     * @param config {Object} An optional properties hash the object should use
     * @param component {Object} An optional component to build from
     * @return {olleh.maps.vector.Rectangle}
     */
    box: function (config, component) {
      var c = component || this.components;

      config = config || {};
      config.bounds = new olleh.maps.Bounds(new this.CRS(c[0]),
          new this.CRS(c[1]));

      return new olleh.maps.vector.Rectangle(config);
    },

    /**
     * Creates the framework's equivalent polygon geometry object.
     * @param config {Object} An optional properties hash the object should use
     * @param component {Object} An optional component to build from
     * @return {olleh.maps.vector.Polygon}
     */
    polygon: function (config, component) {
      var i, l, paths = [];
      var c = component || this.components;

      for (i = 0, l = c.length; i < l; i++) {
        paths.push(constructPath.call(this, c[i]));
      }

      config = config || {};
      config.paths = paths;

      return new olleh.maps.vector.Polygon(config);
    },

    /**
     * Creates the framework's equivalent multipoint geometry object.
     * @param config {Object} An optional properties hash the object should use
     * @return {Array} Array containing multiple olleh.maps.overlay.Marker
     */
    multipoint: function (config) {
      return constructMultigeometry.call(this, this.construct.point, config);
    },

    /**
     * Creates the framework's equivalent multilinestring geometry object.
     * @param config {Object} An optional properties hash the object should use
     * @return {Array} Array containing multiple olleh.maps.vector.Polyline
     *         instances
     */
    multilinestring: function (config) {
      return constructMultigeometry.call(this, this.construct.linestring, config);
    },

    /**
     * Creates the framework's equivalent multipolygon geometry object.
     * @param config {Object} An optional properties hash the object should use
     * @return {Array} Array containing multiple olleh.maps.vector.Polygon
     */
    multipolygon: function (config) {
      return constructMultigeometry.call(this, this.construct.polygon, config);
    }

  };



  ////////////////////////////////////////
  // Deconstruct
  ////////////////////////////////////////

  function pathAsArray(path) {
    var i, l, arr = [];
    for (i = 0, l = path.getLength(); i < l; i++) {
      arr.push(path.getAt(i).xy());
    }
    return arr;
  }

  function deconstructPoint(coord) {
    return {
      type: 'point',
      components: [ coord.xy() ]
    };
  }

  function deconstructLinestring(path) {
    return {
      type: 'linestring',
      components: pathAsArray(path),
    };
  }

  function deconstructPolygon(paths) {
    var i, l, arr = [];
    for (i = 0, l = paths.length; i < l; i++) {
      arr.push(pathAsArray(paths[i]));
    }
    return {
      type: 'polygon',
      components: arr
    };
  }

  function deconstructRectangle(bounds) {
    var path = new olleh.maps.Path([
        bounds.leftBottom,
        bounds.getRightBottomCoord(),
        bounds.rightTop,
        bounds.getLeftTopCoord()
    ]);
    return {
      type: 'polygon',
      isRectangle: true,
      components: [ pathAsArray(path) ]
    };
  }

  function deconstructCircle(center, radius, numSeg) {
    var n, theta, arr = [];

    for (n = 0; n < numSeg; n++) {
      theta = Math.PI * (n / (numSeg / 2));
      arr.push({
        x: center.x + (radius * Math.cos(theta)),
        y: center.y + (radius * Math.sin(theta))
      });
    }

    return {
      type: 'polygon',
      components: [ arr ]
    };
  }

  function deconstructMultigeometry(obj) {
    var i, l, arr = [], feature, type = null;
    for (i = 0, l = obj.length; i < l; i++) {
      feature = this.deconstruct.call(this, obj[i]);
      arr.push(feature.components);
      if (type == null) {
        type = feature.type;
      } else if (type && type != feature.type) {
        type = false;
      }
    }

    return {
      type: type ? 'multi' + type : 'geometrycollection',
      components: arr
    };
  }

  /**
   * @augments Wkt.Wkt A framework-dependent deconstruction method used to
   *           generate internal geometric representations from instances of
   *           framework geometry. This method uses object detection to attempt
   *           to classify members of framework geometry classes into the
   *           standard WKT types.
   * @param obj {Object} An instance of one of the framework's geometry classes
   * @return {Object} A hash of the 'type' and 'components' thus derived, plus
   *         the WKT string of the feature.
   */
  Wkt.Wkt.prototype.deconstruct = function (obj) {
    if (obj instanceof olleh.maps.Coord) {
      return deconstructPoint(obj);
    }

    if (obj instanceof olleh.maps.overlay.Marker) {
      return deconstructPoint(obj.getPosition());
    }

    if (obj instanceof olleh.maps.Path) {
      return deconstructLinestring(obj);
    }

    if (obj instanceof olleh.maps.vector.Polyline) {
      return deconstructLinestring(obj.getPath());
    }

    if (obj instanceof olleh.maps.vector.Polygon) {
      return deconstructPolygon(obj.getPaths());
    }

    if (obj instanceof olleh.maps.vector.Rectangle) {
      return deconstructRectangle(obj.getBounds());
    }

    if (obj instanceof olleh.maps.vector.Circle) {
      return deconstructCircle(obj.getCenter(), obj.getRadius(), this.numSeg);
    }

    if (Wkt.isArray(obj)) {
      return deconstructMultigeometry.call(this, obj);
    }

    console.log('The passed object does not have any recognizable properties.');

  };
})();
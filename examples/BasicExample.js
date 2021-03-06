/* global WorldWind */

requirejs(['../src/WorldWind.js'],
    function(WorldWind) {
        "use strict";
        /**
         * The Globe encapulates the WorldWindow object (wwd) and provides application
         * specific logic for interacting with layers.
         * @param {String} canvasId
         * @param {String|null} projectionName
         * @returns {Globe}
         */
        class Globe {
            constructor(canvasId, projectionName) {
                // Create a WorldWindow globe on the specified HTML5 canvas
                this.wwd = new WorldWind.WorldWindow(canvasId);

                // Projection support
                this.roundGlobe = this.wwd.globe;
                this.flatGlobe = null;
                if (projectionName) {
                    this.changeProjection(projectionName);
                }

                // A map of category and 'observable' timestamp pairs
                this.categoryTimestamps = new Map();

                // Add a BMNGOneImageLayer background layer. We're overriding the default
                // minimum altitude of the BMNGOneImageLayer so this layer always available.
                this.addLayer(new WorldWind.BMNGOneImageLayer(), {
                    category: "background",
                    minActiveAltitude: 0
                });

            }

            get projectionNames() {
                return [
                    "3D",
                    "Equirectangular",
                    "Mercator",
                    "North Polar",
                    "South Polar",
                    "North UPS",
                    "South UPS",
                    "North Gnomonic",
                    "South Gnomonic"
                ];
            }

            changeProjection(projectionName) {
                if (projectionName === "3D") {
                    if (!this.roundGlobe) {
                        this.roundGlobe = new WorldWind.Globe(new WorldWind.EarthElevationModel());
                    }
                    if (this.wwd.globe !== this.roundGlobe) {
                        this.wwd.globe = this.roundGlobe;
                    }
                } else {
                    if (!this.flatGlobe) {
                        this.flatGlobe = new WorldWind.Globe2D();
                    }
                    if (projectionName === "Equirectangular") {
                        this.flatGlobe.projection = new WorldWind.ProjectionEquirectangular();
                    } else if (projectionName === "Mercator") {
                        this.flatGlobe.projection = new WorldWind.ProjectionMercator();
                    } else if (projectionName === "North Polar") {
                        this.flatGlobe.projection = new WorldWind.ProjectionPolarEquidistant("North");
                    } else if (projectionName === "South Polar") {
                        this.flatGlobe.projection = new WorldWind.ProjectionPolarEquidistant("South");
                    } else if (projectionName === "North UPS") {
                        this.flatGlobe.projection = new WorldWind.ProjectionUPS("North");
                    } else if (projectionName === "South UPS") {
                        this.flatGlobe.projection = new WorldWind.ProjectionUPS("South");
                    } else if (projectionName === "North Gnomonic") {
                        this.flatGlobe.projection = new WorldWind.ProjectionGnomonic("North");
                    } else if (projectionName === "South Gnomonic") {
                        this.flatGlobe.projection = new WorldWind.ProjectionGnomonic("South");
                    }
                    if (this.wwd.globe !== this.flatGlobe) {
                        this.wwd.globe = this.flatGlobe;
                    }
                }
            }

            /**
             * Returns a new array of layers within the given category.
             * @param {String} category E.g., "base", "overlay" or "setting".
             * @returns {Array}
             */
            getLayers(category) {
                return this.wwd.layers.filter(layer => layer.category === category);
            }

            /**
             * Add a layer to the globe and applies options object properties to the
             * the layer.
             * @param {WorldWind.Layer} layer
             * @param {Object|null} options E.g., {category: "base", enabled: true}
             */
            addLayer(layer, options) {
                // Copy all properties defined on the options object to the layer
                if (options) {
                    for (let prop in options) {
                        if (!options.hasOwnProperty(prop)) {
                            continue; // skip inherited props
                        }
                        layer[prop] = options[prop];
                    }
                }
                // Assign a category property for layer management
                if (typeof layer.category === 'undefined') {
                    layer.category = 'overlay'; // default category
                }

                // Assign a unique layer ID to ease layer management
                layer.uniqueId = this.nextLayerId++;
                // Add the layer to the globe
                this.wwd.addLayer(layer);
                // Signal a change in the category
                this.updateCategoryTimestamp(layer.category);
            }

            /**
             * Toggles the enabled state of the given layer and updates the layer
             * catetory timestamp. Applies a rule to the 'base' layers the ensures
             * only one base layer is enabled.
             * @param {WorldWind.Layer} layer
             */
            toggleLayer(layer) {
                // Apply rule: only one "base" layer can be enabled at a time
                if (layer.category === 'base') {
                    this.wwd.layers.forEach(function(item) {
                        if (item.category === 'base' && item !== layer) {
                            item.enabled = false;
                        }
                    });
                }
                // Toggle the selected layer's visibility
                layer.enabled = !layer.enabled;
                // Trigger a redraw so the globe shows the new layer state ASAP
                this.wwd.redraw();
                // Signal a change in the category
                this.updateCategoryTimestamp(layer.category);
            }

            /**
             * Returns an observable containing the last update timestamp for the category.
             * @param {String} category
             * @returns {Observable}
             */
            getCategoryTimestamp(category) {
                if (!this.categoryTimestamps.has(category)) {
                    this.categoryTimestamps.set(category, ko.observable());
                }
                return this.categoryTimestamps.get(category);
            }

            /**
             * Updates the timestamp for the given category.
             * @param {String} category
             */
            updateCategoryTimestamp(category) {
                let timestamp = this.getCategoryTimestamp(category);
                timestamp(new Date());
            }
            /**
             * Returns the first layer with the given name.
             * @param {String} name
             * @returns {WorldWind.Layer|null}
             */
            findLayerByName(name) {
                let layers = this.wwd.layers.filter(layer => layer.displayName === name);
                return layers.length > 0 ? layers[0] : null;
            }
        }
        // Set your Bing Maps key which is used when requesting Bing Maps resources.
        // Without your own key you will be using a limited WorldWind developer's key.
        // See: https://www.bingmapsportal.com/ to register for your own key and then enter it below:
        const BING_API_KEY = "";
        if (BING_API_KEY) {
            // Initialize WorldWind properties before creating the first WorldWindow
            WorldWind.BingMapsKey = BING_API_KEY;
        } else {
            console.error("app.js: A Bing API key is required to use the Bing maps in production. Get your API key at https://www.bingmapsportal.com/");
        }

        // Web Map Service information from NASA's Near Earth Observations WMS
        let serviceAddress = "https://neo.sci.gsfc.nasa.gov/wms/wms?SERVICE=WMS&REQUEST=GetCapabilities&VERSION=1.3.0";
        // Named layer displaying Average Temperature data
        let layerName = "MOD_LSTD_CLIM_M";

        // Called asynchronously to parse and create the WMS layer
        let createLayer = function (xmlDom) {
            // Create a WmsCapabilities object from the XML DOM
            let wms = new WorldWind.WmsCapabilities(xmlDom);
            // Retrieve a WmsLayerCapabilities object by the desired layer name
            let wmsLayerCapabilities = wms.getNamedLayer(layerName);
            // Form a configuration object from the WmsLayerCapability object
            let wmsConfig = WorldWind.WmsLayer.formLayerConfiguration(wmsLayerCapabilities);
            // Modify the configuration objects title property to a more user friendly title
            wmsConfig.title = "WMS Layer";
            // Create the WMS Layer from the configuration object
            let wmsLayer = new WorldWind.WmsLayer(wmsConfig);

            // Add the layers to WorldWind and update the layer manager
            globe.addLayer(wmsLayer, {
                displayName: "WMS Layer"
            });
            // layerManager.synchronizeLayerList();
        };

        // Called if an error occurs during WMS Capabilities document retrieval
        let logError = function (jqXhr, text, exception) {
            console.log("There was a failure retrieving the capabilities document: " + text + " exception: " + exception);
        };

        $.get(serviceAddress).done(createLayer).fail(logError);

        // Set the MapQuest API key used for the Nominatim service.
        // Get your own key at https://developer.mapquest.com/
        // Without your own key you will be using a limited WorldWind developer's key.
        const MAPQUEST_API_KEY = "";



        /**
         * loadLayers is a utility function used by the view models to copy
         * layers into an observable array. The top-most layer is first in the
         * observable array.
         * @param {Array} layers
         * @param {ko.observableArray} observableArray
         */
        function loadLayers(layers, observableArray) {
            observableArray.removeAll();
            // Reverse the order of the layers to the top-most layer is first
            layers.reverse().forEach(layer => observableArray.push(layer));
        };

        /**
         * Layers view mode.
         * @param {Globe} globe
         * @returns {undefined}
         */
        function LayersViewModel(globe) {
            let self = this;
            self.baseLayers = ko.observableArray(globe.getLayers('base').reverse());
            self.overlayLayers = ko.observableArray(globe.getLayers('overlay').reverse());
            // Update the view model whenever the model changes
            globe.getCategoryTimestamp('base').subscribe(newValue =>
            loadLayers(globe.getLayers('base'), self.baseLayers));
            globe.getCategoryTimestamp('overlay').subscribe(newValue =>
            loadLayers(globe.getLayers('overlay'), self.overlayLayers));
            // Button click event handler
            self.toggleLayer = function(layer) {
                globe.toggleLayer(layer);
            };
        }

        /**
         * Settings view model.
         * @param {Globe} globe
         */
        function SettingsViewModel(globe) {
            let self = this;
            self.settingLayers = ko.observableArray(globe.getLayers('setting').reverse());
            self.debugLayers = ko.observableArray(globe.getLayers('debug').reverse());
            // Update this view model whenever one of the layer categories change
            globe.getCategoryTimestamp('setting').subscribe(newValue =>
            loadLayers(globe.getLayers('setting'), self.settingLayers));
            globe.getCategoryTimestamp('debug').subscribe(newValue =>
            loadLayers(globe.getLayers('debug'), self.debugLayers));
            // Button click event handler
            self.toggleLayer = function(layer) {
                globe.toggleLayer(layer);
            };
        }

        let locationPoints = [
            {
                "Lat": 47.1443,
                "Lng": -122.1408,
                "Dens": 100,
            },
            {
                "Lat": 48.5602,
                "Lng": -122.4311,
                "Dens": 100,
            },
            {
                "Lat": 46.6085,
                "Lng": -121.6702,
                "Dens": 100,
            },
            {
                "Lat": 47.5862,
                "Lng": -122.5482,
                "Dens": 100,
            },
            {
                "Lat": 47.5207,
                "Lng": -122.5196,
                "Dens": 100,
            },
            {
                "Lat": 47.8432,
                "Lng": -120.8157,
                "Dens": 100,
            },
            {
                "Lat": 46.6437,
                "Lng": -118.5565,
                "Dens": 100,
            },
            {
                "Lat": 47.6813,
                "Lng": -118.0164,
                "Dens": 100,
            },
            {
                "Lat": 46.754,
                "Lng": -118.3106,
                "Dens": 100,
            },
            {
                "Lat": 47.6154,
                "Lng": -121.9096,
                "Dens": 100,
            },
            {
                "Lat": 46.4412,
                "Lng": -122.8493,
                "Dens": 100,
            },
            {
                "Lat": 47.2429,
                "Lng": -122.0576,
                "Dens": 100,
            },
            {
                "Lat": 47.4758,
                "Lng": -122.1905,
                "Dens": 100,
            },
            {
                "Lat": 46.6637,
                "Lng": -122.9647,
                "Dens": 100,
            },
            {
                "Lat": 47.2335,
                "Lng": -118.4053,
                "Dens": 100,
            },
            {
                "Lat": 47.6632,
                "Lng": -122.6499,
                "Dens": 100,
            },
            {
                "Lat": 46.9838,
                "Lng": -118.3427,
                "Dens": 100,
            },
            {
                "Lat": 47.1487,
                "Lng": -122.5512,
                "Dens": 100,
            },
            {
                "Lat": 46.2509,
                "Lng": -123.8576,
                "Dens": 100,
            },
            {
                "Lat": 46.7872,
                "Lng": -122.2666,
                "Dens": 100,
            },
            {
                "Lat": 46.8951,
                "Lng": -121.267,
                "Dens": 100,
            },
            {
                "Lat": 48.0499,
                "Lng": -118.985,
                "Dens": 100,
            },
            {
                "Lat": 47.3381,
                "Lng": -117.2313,
                "Dens": 100,
            },
            {
                "Lat": 47.8045,
                "Lng": -122.1435,
                "Dens": 100,
            },
            {
                "Lat": 47.8114,
                "Lng": -122.6563,
                "Dens": 100,
            },
            {
                "Lat": 47.5207,
                "Lng": -122.2068,
                "Dens": 100,
            },
            {
                "Lat": 47.2405,
                "Lng": -121.1733,
                "Dens": 100,
            },
            {
                "Lat": 47.5508,
                "Lng": -122.6655,
                "Dens": 100,
            },
            {
                "Lat": 47.5625,
                "Lng": -122.2265,
                "Dens": 100,
            },
            {
                "Lat": 47.8285,
                "Lng": -122.3034,
                "Dens": 100,
            },
            {
                "Lat": 47.612,
                "Lng": -119.2892,
                "Dens": 100,
            },
            {
                "Lat": 47.6212,
                "Lng": -120.0048,
                "Dens": 100,
            },
            {
                "Lat": 46.7226,
                "Lng": -122.9695,
                "Dens": 100,
            },
            {
                "Lat": 47.8266,
                "Lng": -117.3419,
                "Dens": 100,
            },
            {
                "Lat": 47.5034,
                "Lng": -122.2329,
                "Dens": 100,
            },
            {
                "Lat": 47.6663,
                "Lng": -122.6828,
                "Dens": 100,
            },
            {
                "Lat": 45.6956,
                "Lng": -121.2805,
                "Dens": 100,
            },
            {
                "Lat": 48.2919,
                "Lng": -119.6955,
                "Dens": 100,
            },
            {
                "Lat": 47.792,
                "Lng": -122.3076,
                "Dens": 100,
            },
            {
                "Lat": 46.3108,
                "Lng": -124.0422,
                "Dens": 100,
            },
            {
                "Lat": 47.4467,
                "Lng": -122.143,
                "Dens": 100,
            },
            {
                "Lat": 48.1649,
                "Lng": -122.3442,
                "Dens": 100,
            },
            {
                "Lat": 47.3537,
                "Lng": -122.229,
                "Dens": 100,
            },
            {
                "Lat": 46.5022,
                "Lng": -120.4668,
                "Dens": 100,
            },
            {
                "Lat": 47.0075,
                "Lng": -117.3502,
                "Dens": 100,
            },
            {
                "Lat": 46.8452,
                "Lng": -122.6562,
                "Dens": 100,
            },
            {
                "Lat": 47.382,
                "Lng": -122.4832,
                "Dens": 100,
            },
            {
                "Lat": 47.1593,
                "Lng": -122.4982,
                "Dens": 100,
            },
            {
                "Lat": 48.5842,
                "Lng": -122.9291,
                "Dens": 100,
            },
            {
                "Lat": 47.1305,
                "Lng": -117.2465,
                "Dens": 100,
            },
            {
                "Lat": 46.3076,
                "Lng": -123.6344,
                "Dens": 100,
            },
        ];

        for (var l = 0; l < locationPoints.length; l++) {
            console.log(locationPoints[l].Lat);
            console.log(locationPoints[l].Lng);
        }

        console.log(locationPoints.length);


        /**
         * Tools view model for tools palette on the globe
         * @param {Globe} globe
         * @param {MarkersViewModel} markers
         * @returns {ToolsViewModel}
         */
        function ToolsViewModel(globe, markers) {
            let self = this,
                imagePath = "https://unpkg.com/worldwindjs@1.5.90/build/dist/images/pushpins/";
            // An array of pushpin marker images
            self.markerPalette = [
                imagePath + "castshadow-red.png",
                imagePath + "castshadow-green.png",
                imagePath + "castshadow-blue.png",
                imagePath + "castshadow-orange.png",
                imagePath + "castshadow-teal.png",
                imagePath + "castshadow-purple.png",
                imagePath + "castshadow-white.png",
                imagePath + "castshadow-black.png"
            ];
            // The currently selected marker icon
            self.selectedMarkerImage = ko.observable(self.markerPalette[0]);
            // Callback invoked by the Click/Drop event handler
            self.dropCallback = null;
            // The object dropped on the globe at the click location
            self.dropObject = null;
            // Observable boolean indicating that click/drop is armed
            self.isDropArmed = ko.observable(false);
            // Change the globe's cursor to crosshairs when drop is armed
            self.isDropArmed.subscribe(armed =>
            $(globe.wwd.canvas).css("cursor", armed ? "crosshair" : "default"));
            // Button click event handler to arm the drop
            self.armDropMarker = function() {
                self.isDropArmed(true);
                self.dropCallback = self.dropMarkerCallback;
                self.dropObject = self.selectedMarkerImage();
            };

            // Set up the common placemark attributes used in the dropMarkerCallback
            let commonAttributes = new WorldWind.PlacemarkAttributes(null);
            commonAttributes.imageScale = 1;
            commonAttributes.imageOffset = new WorldWind.Offset(
                WorldWind.OFFSET_FRACTION, 0.3,
                WorldWind.OFFSET_FRACTION, 0.0);
            commonAttributes.imageColor = WorldWind.Color.WHITE;
            commonAttributes.labelAttributes.offset = new WorldWind.Offset(
                WorldWind.OFFSET_FRACTION, 0.5,
                WorldWind.OFFSET_FRACTION, 1.0);
            commonAttributes.labelAttributes.color = WorldWind.Color.YELLOW;
            commonAttributes.drawLeaderLine = true;
            commonAttributes.leaderLineAttributes.outlineColor = WorldWind.Color.RED;
            /**
             * "Drop" action callback creates and adds a marker (WorldWind.Placemark) to the globe.
             *
             * @param {WorldWind.Location} position
             */
            self.dropMarkerCallback = function(position) {
                let attributes = new WorldWind.PlacemarkAttributes(commonAttributes);
                attributes.imageSource = self.selectedMarkerImage();

                let placemark = new WorldWind.Placemark(position, /*eyeDistanceScaling*/ true, attributes);
                placemark.label = "Lat " + position.latitude.toPrecision(4).toString() + "\n" + "Lon " + position.longitude.toPrecision(5).toString();
                placemark.altitudeMode = WorldWind.CLAMP_TO_GROUND;
                placemark.eyeDistanceScalingThreshold = 2500000;

                let Lati = position.latitude.toPrecision(4).toString();
                let Poppy = $(".popover");


                if(placemark.displayName = "Renderable") {
                    console.log("Something, something, something");
                }

                console.log(placemark.layer);

                globe.wwd.deepPicking = true;

                let highlightedItems = [];


                function myNewFunction(x, y, Lati, Long) {
                    Poppy.popover("show");
                    Poppy.attr("data-content", "This is a placemark located at latitude " + Lati + " and longitude " + Long + ".");
                    Poppy.css({"top":y, "left":x});
                }


                let handlePick =  function (o) {
                    let newX = o.clientX,
                        newY = o.clientY,
                        myX = o.pageX,
                        myY = o.pageY;



                    let redrawRequired = highlightedItems.length > 0;

                    for (let h = 0; h < highlightedItems.length; h++) {
                        highlightedItems[h].highlighted = false;
                    }
                    highlightedItems = [];

                    let newPickList = globe.wwd.pick(globe.wwd.canvasCoordinates(newX, newY));

                    if (newPickList.objects.length > 0) {
                        redrawRequired = true;

                        let numShapesPicked = 0;
                        for (let p = 0; p < newPickList.objects.length; p++) {
                            newPickList.objects[p].userObject.highlighted = true;

                            highlightedItems.push(newPickList.objects[p].userObject);

                            if (!newPickList.objects[p].isTerrain) {
                                ++numShapesPicked;
                            }
                        }

                        for (let newP = 0; newP < newPickList.objects.length; newP++) {
                            if (newPickList.objects[newP].userObject instanceof WorldWind.Placemark) {

                                console.log(newPickList.objects[newP].userObject);
                                let placemarkAttributes = newPickList.objects[newP].userObject;

                                myNewFunction(myX, myY, placemarkAttributes.position.latitude, placemarkAttributes.position.longitude);

                            }

                            else {
                                Poppy.popover("hide");
                            }
                        }

                    }


                    if (redrawRequired) {
                        globe.wwd.redraw();
                    }

                };

                globe.wwd.addEventListener("mousemove", handlePick);


                // Add the placemark to the layer and to the observable array
                let layer = globe.findLayerByName("Markers");
                layer.addRenderable(placemark);
                markers.addMarker(placemark);

            };


            /**
             * Handles a click on the WorldWindow. If a "drop" action callback has been
             * defined, it invokes the function with the picked location.
             * @param {Object} event
             */
            self.handleClick = function(event) {
                if (!self.isDropArmed()) {
                    return;
                }
                // Get the clicked window coords
                let type = event.type,
                    x, y;
                switch (type) {
                    case 'click':
                        x = event.clientX;
                        y = event.clientY;
                        break;
                    case 'touchend':
                        if (!event.changedTouches[0]) {
                            return;
                        }
                        x = event.changedTouches[0].clientX;
                        y = event.changedTouches[0].clientY;
                        break;
                }

                if (self.dropCallback) {
                    // Get all the picked items
                    let pickList = globe.wwd.pickTerrain(globe.wwd.canvasCoordinates(x, y));
                    // Terrain should be one of the items if the globe was clicked
                    let terrain = pickList.terrainObject();
                    if (terrain) {
                        self.dropCallback(terrain.position, self.dropObject);
                    }
                }

                self.isDropArmed(false);
                event.stopImmediatePropagation();


            };

            // Assign a click event handlers to the WorldWindow for Click/Drop support
            globe.wwd.addEventListener('click', self.handleClick);
            globe.wwd.addEventListener('touchend', self.handleClick);
        }

        /**
         * Markers view model.
         * @param {Globe} globe
         * @returns {MarkersViewModel}
         */
        function MarkersViewModel(globe) {
            let self = this;
            // Observable array of markers displayed in the view
            self.markers = ko.observableArray();

            /**
             * Adds a marker to the view model
             * @param {WorldWind.Placemark} marker
             */
            self.addMarker = function(marker) {
                self.markers.push(marker);
            };

            /**
             * "Goto" function centers the globe on the given marker.
             * @param {WorldWind.Placemark} marker
             */
            self.gotoMarker = function(marker) {
                globe.wwd.goTo(new WorldWind.Location(marker.position.latitude, marker.position.longitude));
            };

            /**
             * "Edit" function invokes a modal dialog to edit the marker attributes.
             * @param {WorldWind.Placemark} marker
             */

            /**
             * "Remove" function removes a marker from the globe.
             * @param {WorldWind.Placemark} marker
             */
            self.removeMarker = function(marker) {
                // Find and remove the marker from the layer and the observable array
                let markerLayer = globe.findLayerByName("Markers");
                for (let i = 0, max = self.markers().length; i < max; i++) {
                    let placemark = markerLayer.renderables[i];
                    if (placemark === marker) {
                        markerLayer.renderables.splice(i, 1);
                        self.markers.remove(marker);
                        break;
                    }
                }
            };
        }
        /**
         * Search view model. Uses the MapQuest Nominatim API.
         * Requires an access key. See: https://developer.mapquest.com/
         * @param {Globe} globe
         * @param {Function} preview Function to preview the results
         * @returns {SearchViewModel}
         */
        function SearchViewModel(globe, preview) {
            let self = this;
            self.geocoder = new WorldWind.NominatimGeocoder();
            self.searchText = ko.observable('');
            self.performSearch = function() {
                if (!MAPQUEST_API_KEY) {
                    console.error("SearchViewModel: A MapQuest API key is required to use the geocoder in production. Get your API key at https://developer.mapquest.com/");
                }
                // Get the value from the observable
                let queryString = self.searchText();
                if (queryString) {
                    if (queryString.match(WorldWind.WWUtil.latLonRegex)) {
                        // Treat the text as a lat, lon pair
                        let tokens = queryString.split(",");
                        let latitude = parseFloat(tokens[0]);
                        let longitude = parseFloat(tokens[1]);
                        // Center the globe on the lat, lon
                        globe.wwd.goTo(new WorldWind.Location(latitude, longitude));
                    } else {
                        // Treat the text as an address or place name
                        self.geocoder.lookup(queryString, function(geocoder, results) {
                            if (results.length > 0) {
                                // Open the modal dialog to preview and select a result
                                preview(results);
                            }
                        }, MAPQUEST_API_KEY);
                    }
                }
            };
        }

        /**
         * Define the view model for the Search Preview.
         * @param {WorldWindow} primaryGlobe
         * @returns {PreviewViewModel}
         */
        function PreviewViewModel(primaryGlobe) {
            let self = this;
            // Show a warning message about the MapQuest API key if missing
            this.showApiWarning = (MAPQUEST_API_KEY === null || MAPQUEST_API_KEY === "");
            // Create secondary globe with a 2D Mercator projection for the preview
            this.previewGlobe = new Globe("preview-canvas", "Mercator");
            let resultsLayer = new WorldWind.RenderableLayer("Results");
            let bingMapsLayer = new WorldWind.BingRoadsLayer();
            bingMapsLayer.detailControl = 1.25; // Show next level-of-detail sooner. Default is 1.75
            this.previewGlobe.addLayer(bingMapsLayer);
            this.previewGlobe.addLayer(resultsLayer);
            // Set up the common placemark attributes for the results
            let placemarkAttributes = new WorldWind.PlacemarkAttributes(null);
            placemarkAttributes.imageSource = WorldWind.configuration.baseUrl + "images/pushpins/castshadow-red.png";
            placemarkAttributes.imageScale = 0.5;
            placemarkAttributes.imageOffset = new WorldWind.Offset(
                WorldWind.OFFSET_FRACTION, 0.3,
                WorldWind.OFFSET_FRACTION, 0.0);
            // Create an observable array who's contents are displayed in the preview
            this.searchResults = ko.observableArray();
            this.selected = ko.observable();
            // Shows the given search results in a table with a preview globe/map
            this.previewResults = function(results) {
                if (results.length === 0) {
                    return;
                }
                // Clear the previous results
                self.searchResults.removeAll();
                resultsLayer.removeAllRenderables();
                // Add the results to the observable array
                results.map(item => self.searchResults.push(item));
                // Create a simple placemark for each result
                for (let i = 0, max = results.length; i < max; i++) {
                    let item = results[i];
                    let placemark = new WorldWind.Placemark(
                        new WorldWind.Position(
                            parseFloat(item.lat),
                            parseFloat(item.lon), 100));
                    placemark.altitudeMode = WorldWind.RELATIVE_TO_GROUND;
                    placemark.displayName = item.display_name;
                    placemark.attributes = placemarkAttributes;
                    resultsLayer.addRenderable(placemark);
                }

                // Initialize preview with the first item
                self.previewSelection(results[0]);
                // Display the preview dialog
                $('#previewDialog').modal();
                $('#previewDialog .modal-body-table').scrollTop(0);
            };
            this.previewSelection = function(selection) {
                let latitude = parseFloat(selection.lat),
                    longitude = parseFloat(selection.lon),
                    location = new WorldWind.Location(latitude, longitude);
                // Update our observable holding the selected location
                self.selected(location);
                // Go to the posiion
                self.previewGlobe.wwd.goTo(location);
            };
            this.gotoSelected = function() {
                // Go to the location held in the selected observable
                primaryGlobe.wwd.goTo(self.selected());
            };
        }

        // ---------------------
        // Construct our web app
        // ----------------------

        // Create the primary globe
        let globe = new Globe("globe-canvas");
        // Add layers ordered by drawing order: first to last
        // Add layers to the globe
        globe.addLayer(new WorldWind.BMNGLayer(), {
            category: "base"
        });
        globe.addLayer(new WorldWind.BMNGLandsatLayer(), {
            category: "base",
            enabled: false
        });
        globe.addLayer(new WorldWind.BingAerialLayer(), {
            category: "base",
            enabled: false
        });
        globe.addLayer(new WorldWind.BingAerialWithLabelsLayer(), {
            category: "base",
            enabled: false,
            detailControl: 1.5
        });
        globe.addLayer(new WorldWind.BingRoadsLayer(), {
            category: "overlay",
            enabled: false,
            detailControl: 1.5,
            opacity: 0.80
        });
        globe.addLayer(new WorldWind.RenderableLayer("Markers"), {
            category: "overlay",
            displayName: "Markers",
            enabled: true
        });
        globe.addLayer(new WorldWind.CoordinatesDisplayLayer(globe.wwd), {
            category: "setting"
        });
        globe.addLayer(new WorldWind.ViewControlsLayer(globe.wwd), {
            category: "setting"
        });
        globe.addLayer(new WorldWind.CompassLayer(), {
            category: "setting",
            enabled: false
        });
        globe.addLayer(new WorldWind.StarFieldLayer(), {
            category: "setting",
            enabled: false,
            displayName: "Stars"
        });
        globe.addLayer(new WorldWind.AtmosphereLayer(), {
            category: "setting",
            enabled: false,
            time: null // new Date() // activates day/night mode
        });
        globe.addLayer(new WorldWind.ShowTessellationLayer(), {
            category: "debug",
            enabled: false
        });


        var locations = [];
        for (var i = 0; i < locationPoints.length; i++) {
            locations.push(
                new WorldWind.MeasuredLocation(
                    locationPoints[i].Lat,
                    locationPoints[i].Lng,
                    locationPoints[i].Dens
                )
            );
        }

        // Add new HeatMap Layer with the points as the data source.
        globe.addLayer(new WorldWind.HeatMapLayer("HeatMap", locations), {
            displayName: "HeatMap"
        });

        console.log(WorldWind.MeasuredLocation);


        // Activate the Knockout bindings between our view models and the html
        let layers = new LayersViewModel(globe);
        let settings = new SettingsViewModel(globe);
        let markers = new MarkersViewModel(globe);
        let tools = new ToolsViewModel(globe, markers);
        let preview = new PreviewViewModel(globe);
        let search = new SearchViewModel(globe, preview.previewResults);
        ko.applyBindings(layers, document.getElementById('layers'));
        ko.applyBindings(settings, document.getElementById('settings'));
        ko.applyBindings(markers, document.getElementById('markers'));
        ko.applyBindings(tools, document.getElementById('tools'));
        ko.applyBindings(search, document.getElementById('search'));
        ko.applyBindings(preview, document.getElementById('preview'));


        // Auto-collapse the main menu when its button items are clicked
        $('.navbar-collapse a[role="button"]').click(function() {
            $('.navbar-collapse').collapse('hide');
        });
        // Collapse card ancestors when the close icon is clicked
        $('.collapse .close').on('click', function() {
            $(this).closest('.collapse').collapse('hide');
        });
    });

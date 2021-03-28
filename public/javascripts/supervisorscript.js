// Supervisor page -- load the shifts of the employees and display in table, with option to check map
//var UPDATE_INTERVAL = 5000; //ms

var shiftdata;
var checkindata;

var map = new ol.Map({
	target: 'map',
	layers: [
		new ol.layer.Tile({
			source: new ol.source.OSM()
		})
	],
	view: new ol.View({
		center: ol.proj.fromLonLat([-97.0, 39.0]),
		zoom: 4
	})
});

var markerLayer;

function loadSchedules() {
	var xhttp = new XMLHttpRequest();
	xhttp.onreadystatechange = function() {
		if (this.readyState == 4 && this.status == 200) {
			// Parse the JSON reponse
			//console.log(xhttp.responseText);
			var res = JSON.parse(xhttp.responseText);
			if (res.length > 0) {
				shiftdata = res;
				//console.log(res);
				for (var i = 0; i < res.length; i++) {
					var date = new Date(res[i].start_time.split(' ')[0]);
					//dayofweek = date.getDay();
					var currdate = new Date();
					// 24 hours
					if (currdate - date > 1000*60*60*24) {
						continue; // Don't show this shift, it was in the past
					} 
					// TODO: Don't show if more than a month ahead?
					// TODO: Account for the repeat length
					var parent = document.getElementById('shifts');
					var newel = document.createElement('tr');
					newel.innerHTML = '<td>'+res[i].first_name+' '+res[i].last_name+'</td><td>'+res[i].email_address+'</td><td>'+res[i].site_name+'</td><td>'+res[i].start_time.split(' ')[0]+'</td><td>'+res[i].start_time.split(' ')[1]+'-'+res[i].end_time.split(' ')[1]+'</td><td><button onclick="showMap('+i+')">See map</button></td>';
					parent.appendChild(newel);
				}
			}
			else {
				console.log('Empty result');
			}
		}
	};
	xhttp.open('GET', 'allschedules', true);
	xhttp.send();
}

function getDistanceFromLatLonInKm(lat1,lon1,lat2,lon2) {
  var R = 6371; // Radius of the earth in km
  var dLat = deg2rad(lat2-lat1);  // deg2rad below
  var dLon = deg2rad(lon2-lon1); 
  var a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
    Math.sin(dLon/2) * Math.sin(dLon/2)
    ; 
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  var d = R * c; // Distance in km
  return Math.round(d*1000)/1000;
}

function deg2rad(deg) {
  return deg * (Math.PI/180)
}

function loadShifts() {
	var xhttp = new XMLHttpRequest();
	xhttp.onreadystatechange = function() {
		if (this.readyState == 4 && this.status == 200) {
			// Parse the JSON reponse
			//console.log(xhttp.responseText);
			var res = JSON.parse(xhttp.responseText);
			if (res.length > 0) {
				checkindata = res;
				//console.log(res);
				for (var i = 0; i < res.length; i++) {
					var date = new Date(res[i].clock_in_time.split(' ')[0]);
					//dayofweek = date.getDay();
					var currdate = new Date();
					// 24 hours
					if (currdate - date > 1000*60*60*24) {
						continue; // Don't show this shift, it was in the past
					} 
					// TODO: Don't show if more than a month ahead?
					// TODO: Account for the repeat length
					var parent = document.getElementById('checkins');
					var newel = document.createElement('tr');
					var startTime = res[i].clock_in_time.split(' ')[1];
					var endTime = (res[i].clock_out_time) ? res[i].clock_out_time.split(' ')[1] : 'N/A';
					
					// Calculate some useful metrics
					var duration = 'N/A';
					var dist1 = getDistanceFromLatLonInKm(res[i].latitude, res[i].longitude, res[i].latitude_in, res[i].longitude_in);
					var dist2 = 'N/A';
					if (endTime != 'N/A') {
						duration = (new Date(res[i].clock_out_time) - new Date(res[i].clock_in_time))/1000;
						dist2 = getDistanceFromLatLonInKm(res[i].latitude, res[i].longitude, res[i].latitude_out, res[i].longitude_out);
					}
					
					newel.innerHTML = '<td>'+res[i].first_name+' '+res[i].last_name+'</td><td>'+res[i].email_address+'</td><td>'+res[i].site_name+'</td><td>'+res[i].clock_in_time.split(' ')[0]+'</td><td>'+startTime+'</td><td>'+endTime+'</td><td><button onclick="showCheckinMap('+i+')">See map</button></td><td>'+duration+'</td><td>'+dist1+'</td><td>'+dist2+'</td>';
					parent.appendChild(newel);
				}
			}
			else {
				console.log('Empty result');
			}
		}
	};
	xhttp.open('GET', 'allshifts', true);
	xhttp.send();
}

// TODO: Get schedule for a particular employee?

function checkStatus(next) {
	statusChecked = false;
	var xhttp = new XMLHttpRequest();
	xhttp.onreadystatechange = function() {
		if (this.readyState == 4 && this.status == 200) {
			// Parse the JSON reponse
			//console.log(xhttp.responseText);
			var res = xhttp.responseText;
			console.log('Checked in: '+res);
			if (res) {
				document.getElementById('status').innerHTML = 'Checked in <button onclick="checkOut()">Check out</button>';
			}
			else {
				document.getElementById('status').innerHTML = 'Not checked in';
			}
			next(res);
		}
	};
	xhttp.open('GET', 'status', true);
	xhttp.send();
	
}

function checkIn(index) {
	checkStatus((status) => {
		if (status) {
			console.log('Already checked in!');
			document.getElementById('message').innerHTML = 'Already checked in!';
		}
		else {
			if (index < 0 || index >= shiftdata.length) {
				console.log('Bad index for check in');
				return;
			}
			
			if (navigator.geolocation) {
				navigator.geolocation.getCurrentPosition(function(position) {
					console.log(position.coords.longitude + ', ' + position.coords.latitude);
					
					// Update the map
					
					map.getView().setCenter(ol.proj.fromLonLat([shiftdata[index].longitude, shiftdata[index].latitude]));
					map.getView().setZoom(16);
					
					if (markerLayer) {
						map.removeLayer(markerLayer);
					}
					
					var marker1 = new ol.Feature({
						geometry: new ol.geom.Point(ol.proj.fromLonLat([shiftdata[index].longitude, shiftdata[index].latitude]))
					});
					marker1.setStyle(new ol.style.Style({
						image: new ol.style.Icon(({
							color: '#00ff00',
							crossOrigin: 'anonymous',
							src: 'images/marker.png'
						}))
					}));
					
					var marker2 = new ol.Feature({
						geometry: new ol.geom.Point(ol.proj.fromLonLat([position.coords.longitude, position.coords.latitude]))
					});
					marker2.setStyle(new ol.style.Style({
						image: new ol.style.Icon(({
							color: '#ffff00',
							crossOrigin: 'anonymous',
							src: 'images/marker.png'
						}))
					}));
					
					var vectorSource = new ol.source.Vector({ features: [marker1, marker2] } );
					markerLayer = new ol.layer.Vector({ source: vectorSource });
					map.addLayer(markerLayer);
					
					document.getElementById('address').innerHTML = shiftdata[index].site_name + ' @ ' + shiftdata[index].address + ', ' + shiftdata[index].city + ', ' + shiftdata[index].state + ' ' + shiftdata[index].zip;
					
					// Check in
					var xhttp = new XMLHttpRequest();
					xhttp.onreadystatechange = function() {
						if (this.readyState == 4 && this.status == 200) {
							// Parse the JSON reponse
							//console.log(xhttp.responseText);
							var res = xhttp.responseText;
							console.log(res);
							if (res == 'success') {
								document.getElementById('message').innerHTML = 'Check in successful!';
							}
							else {
								document.getElementById('message').innerHTML = 'Check in failed!';
							}
						}
					};
					xhttp.open('GET', 'checkin?site_id='+shiftdata[index].site_id+'&latitude_in='+position.coords.latitude+'&longitude_in='+position.coords.longitude, true);
					xhttp.send();
					
					
				});
			} else {
				document.getElementById('message').innerHTML = "Geolocation is not supported by this browser.";
			}
		}
	});
	
}

function checkOut() {
	checkStatus((status) => {
		console.log(status);
		if (status) {
			if (navigator.geolocation) {
				navigator.geolocation.getCurrentPosition(function(position) {
					console.log(position.coords.longitude + ', ' + position.coords.latitude);
					
					// Update the map
					
					if (markerLayer) {
						map.removeLayer(markerLayer);
					}
					
					/*
					map.getView().setCenter(ol.proj.fromLonLat([shiftdata[index].longitude, shiftdata[index].latitude]));
					map.getView().setZoom(16);
					
					var marker1 = new ol.Feature({
						geometry: new ol.geom.Point(ol.proj.fromLonLat([shiftdata[index].longitude, shiftdata[index].latitude]))
					});
					marker1.setStyle(new ol.style.Style({
						image: new ol.style.Icon(({
							color: '#00ff00',
							crossOrigin: 'anonymous',
							src: 'images/marker.png'
						}))
					}));
					
					document.getElementById('address').innerHTML = shiftdata[index].site_name + ' @ ' + shiftdata[index].address + ', ' + shiftdata[index].city + ', ' + shiftdata[index].state + ' ' + shiftdata[index].zip;
					*/
					
					var marker2 = new ol.Feature({
						geometry: new ol.geom.Point(ol.proj.fromLonLat([position.coords.longitude, position.coords.latitude]))
					});
					marker2.setStyle(new ol.style.Style({
						image: new ol.style.Icon(({
							color: '#ffff00',
							crossOrigin: 'anonymous',
							src: 'images/marker.png'
						}))
					}));
					
					var vectorSource = new ol.source.Vector({ features: [marker2] } );
					markerLayer = new ol.layer.Vector({ source: vectorSource });
					map.addLayer(markerLayer);
					
					// Check out
					var xhttp = new XMLHttpRequest();
					xhttp.onreadystatechange = function() {
						if (this.readyState == 4 && this.status == 200) {
							// Parse the JSON reponse
							//console.log(xhttp.responseText);
							var res = xhttp.responseText;
							console.log(res);
							if (res == 'success') {
								document.getElementById('status').innerHTML = 'Checked out';
								document.getElementById('message').innerHTML = 'Check out successful!';
							}
							else {
								document.getElementById('message').innerHTML = 'Check out failed!';
							}
						}
					};
					xhttp.open('GET', 'checkout?&latitude_out='+position.coords.latitude+'&longitude_out='+position.coords.longitude, true);
					xhttp.send();
					
					
				});
			} else {
				document.getElementById('message').innerHTML = "Geolocation is not supported by this browser.";
			}
		}
		else {
			console.log('Not checked in!');
			document.getElementById('message').innerHTML = 'Not checked in!';
		}
	});
}

function showMap(index) {
	if (index < 0 || index >= shiftdata.length) {
		console.log('Bad index for show map');
		return;
	}
	map.getView().setCenter(ol.proj.fromLonLat([shiftdata[index].longitude, shiftdata[index].latitude]));
	map.getView().setZoom(16);
	
	if (markerLayer) {
		map.removeLayer(markerLayer);
	}
	
	var marker = new ol.Feature({
		geometry: new ol.geom.Point(ol.proj.fromLonLat([shiftdata[index].longitude, shiftdata[index].latitude]))
	});
	marker.setStyle(new ol.style.Style({
		image: new ol.style.Icon(({
			color: '#ffff00',
			crossOrigin: 'anonymous',
			src: 'images/marker.png'
		}))
	}));
	
	var vectorSource = new ol.source.Vector({ features: [marker] } );
	markerLayer = new ol.layer.Vector({ source: vectorSource });
	map.addLayer(markerLayer);
	
	document.getElementById('address').innerHTML = shiftdata[index].site_name + ' @ ' + shiftdata[index].address + ', ' + shiftdata[index].city + ', ' + shiftdata[index].state + ' ' + shiftdata[index].zip;
}

function showCheckinMap(index) {
	if (index < 0 || index >= checkindata.length) {
		console.log('Bad index for show map');
		return;
	}
	map.getView().setCenter(ol.proj.fromLonLat([checkindata[index].longitude, checkindata[index].latitude]));
	map.getView().setZoom(16);
	
	if (markerLayer) {
		map.removeLayer(markerLayer);
	}
	
	var marker = new ol.Feature({
		geometry: new ol.geom.Point(ol.proj.fromLonLat([checkindata[index].longitude, checkindata[index].latitude]))
	});
	marker.setStyle(new ol.style.Style({
		image: new ol.style.Icon(({
			color: '#ffff00',
			crossOrigin: 'anonymous',
			src: 'images/marker.png'
		}))
	}));
	
	var marker_in = new ol.Feature({
		geometry: new ol.geom.Point(ol.proj.fromLonLat([checkindata[index].longitude_in, checkindata[index].latitude_in]))
	});
	marker_in.setStyle(new ol.style.Style({
		image: new ol.style.Icon(({
			color: '#00ff00',
			crossOrigin: 'anonymous',
			src: 'images/marker.png'
		}))
	}));
	
	var marker_out = null;
	if (checkindata[index].longitude_out) {
		var marker_out = new ol.Feature({
			geometry: new ol.geom.Point(ol.proj.fromLonLat([checkindata[index].longitude_out, checkindata[index].latitude_out]))
		});
		marker_out.setStyle(new ol.style.Style({
			image: new ol.style.Icon(({
				color: '#ff0000',
				crossOrigin: 'anonymous',
				src: 'images/marker.png'
			}))
		}));
	}
	
	markers = [marker, marker_in];
	if (marker_out) {
		markers.push(marker_out);
	}
	
	var vectorSource = new ol.source.Vector({ features: markers } );
	markerLayer = new ol.layer.Vector({ source: vectorSource });
	map.addLayer(markerLayer);
	
	document.getElementById('address').innerHTML = checkindata[index].site_name + ' @ ' + checkindata[index].address + ', ' + checkindata[index].city + ', ' + checkindata[index].state + ' ' + checkindata[index].zip;
}

loadSchedules();
loadShifts();

//setInterval(update, UPDATE_INTERVAL);
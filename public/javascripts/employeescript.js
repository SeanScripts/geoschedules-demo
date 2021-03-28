// Employee page -- load the shifts and allow checking in
//var UPDATE_INTERVAL = 5000; //ms

var shiftdata;

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

function loadShifts() {
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
					var timeframe = 'Later';
					if (date.getYear() == currdate.getYear() && date.getMonth() == currdate.getMonth() && date.getDate() == currdate.getDate()) {
						timeframe = 'Today';
					}
					// TODO: Don't show if more than a month ahead?
					// TODO: Account for the repeat length
					var parent = document.getElementById(timeframe);
					var newel = document.createElement('table');
					newel.setAttribute('border', '1');
					//if (timeframe == 'Today') { //TODO: Uncomment this if/else block to not allow checking in if the date of the shift is not today
						newel.innerHTML = '<tr><td>Site: '+res[i].site_name+'</td><td rowspan="4"><button onclick="checkIn('+i+')">Check in</button></td></tr><tr><td>Date: '+res[i].start_time.split(' ')[0]+'</td></tr><tr><td>Time: '+res[i].start_time.split(' ')[1]+'-'+res[i].end_time.split(' ')[1]+'</td></tr><tr><td>Location: <button onclick="showMap('+i+')">See map</button></td></tr>';
					/*
					}
					else {
						newel.innerHTML = '<tr><td>Site: '+res[i].site_name+'</td></tr><tr><td>Date: '+res[i].start_time.split(' ')[0]+'</td></tr><tr><td>Time: '+res[i].start_time.split(' ')[1]+'-'+res[i].end_time.split(' ')[1]+'</td></tr><tr><td>Location: <button onclick="showMap('+i+')">See map</button></td></tr>';
					}
					*/
					parent.appendChild(newel);
				}
			}
			else {
				console.log('Empty result');
			}
		}
	};
	xhttp.open('GET', 'schedule', true);
	xhttp.send();
}

function checkStatus(next) {
	statusChecked = false;
	var xhttp = new XMLHttpRequest();
	xhttp.onreadystatechange = function() {
		if (this.readyState == 4 && this.status == 200) {
			// Parse the JSON reponse
			//console.log(xhttp.responseText);
			var res = xhttp.responseText;
			console.log('Checked in: '+res);
			if (res == 'true') {
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
		if (status == 'true') {
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
								document.getElementById('status').innerHTML = 'Checked in <button onclick="checkOut()">Check out</button>';
								document.getElementById('message').innerHTML = 'Check in successful!';
							}
							else {
								document.getElementById('message').innerHTML = 'Check in failed!';
								document.getElementById('status').innerHTML = 'Not checked in';
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
		if (status == 'true') {
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
								document.getElementById('status').innerHTML = 'Checked in <button onclick="checkOut()">Check out</button>';
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
			color: '#00ff00',
			crossOrigin: 'anonymous',
			src: 'images/marker.png'
		}))
	}));
	
	var vectorSource = new ol.source.Vector({ features: [marker] } );
	markerLayer = new ol.layer.Vector({ source: vectorSource });
	map.addLayer(markerLayer);
	
	document.getElementById('address').innerHTML = shiftdata[index].site_name + ' @ ' + shiftdata[index].address + ', ' + shiftdata[index].city + ', ' + shiftdata[index].state + ' ' + shiftdata[index].zip;
}


// On page load, set status correctly
checkStatus(function(status) {console.log('Initialized with status: '+status)});

loadShifts();

//setInterval(update, UPDATE_INTERVAL);
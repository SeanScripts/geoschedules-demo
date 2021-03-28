var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var hash = require('pbkdf2-password')()
var session = require('express-session');
var sqlite3 = require('sqlite3').verbose();

var db = new sqlite3.Database('geoschedules.db', (err) => { if (err) { console.log('Unable to connect to database'); } console.log('Connected to database'); });

//var indexRouter = require('./routes/index');
//var usersRouter = require('./routes/users');

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
  resave: false, // don't save session if unmodified
  saveUninitialized: false, // don't create session until something stored
  secret: 'shhhh, very secret'
}));

//app.use('/', indexRouter);
//app.use('/users', usersRouter);

// Session-persisted message middleware

app.use(function(req, res, next){
  var err = req.session.error;
  var msg = req.session.success;
  delete req.session.error;
  delete req.session.success;
  res.locals.message = '';
  res.locals.first_name = '';
  res.locals.last_name = '';
  res.locals.email_address = '';
  if (err) res.locals.message = '<p class="msg error">' + err + '</p>';
  if (msg) res.locals.message = '<p class="msg success">' + msg + '</p>';
  if (req.session.user) {
	res.locals.first_name = req.session.user.first_name;
	res.locals.last_name = req.session.user.last_name;
	res.locals.email_address = req.session.user.email_address;
  }
  next();
});





function authenticate(name, pass, fn) {
  if (!module.parent) console.log('authenticating %s:%s', name, pass);
  console.log('Start authentication');
  console.log('Check for manager');
  var is_manager = false;
  var stmt1 = db.prepare('SELECT * FROM supervisor WHERE email_address = ?');
  stmt1.each(name, (err1, row) => {
    is_manager = true;
    console.log(row.email_address);
    hash({ password: pass, salt: row.salt }, function (err2, pass, salt, hash) {
      if (err2) return fn(err2);
      if (hash === row.hash) return fn(null, row, true)
      fn(new Error('invalid password'));
    });
  }, (err3, count1) => {
    console.log('Finalize manager ('+count1+')');
    stmt1.finalize();
	if (count1 == 0) {
		console.log('Check for employee');
		// Check for employee
		var stmt2 = db.prepare('SELECT * FROM employee WHERE email_address = ?');
		stmt2.each(name, (err4, row) => {
		  console.log(row.email_address);
		  hash({ password: pass, salt: row.salt }, function (err5, pass, salt, hash) {
			if (err5) return fn(err5);
			if (hash === row.hash) return fn(null, row, false)
			fn(new Error('invalid password'));
		  });
		}, (err6, count2) => {
		  console.log('Finalize employee ('+count2+')');
		  stmt2.finalize();
		  if (count2 == 0) {
			return fn(err6);
		  }
		});
	}
  });
}

function restrict(req, res, next) {
  if (req.session.user) {
    next();
  } else {
    req.session.error = 'Access denied!';
    res.redirect('/login');
  }
}

function restrictSupervisor(req, res, next) {
  if (req.session.user && req.session.isSupervisor) {
	  next();
  } else {
	req.session.error = 'Access denied!';
    res.redirect('/login');
  }
}

// Main page
app.get('/', function(req, res){
	if (req.session.user) {
		if (req.session.isSupervisor) {
			res.redirect('/supervisor');
		}
		else {
			res.redirect('/employee');
		}
	}
	else {
		res.redirect('/login');
	}
});

app.get('/restricted', restrict, function(req, res){
  res.send('Wahoo! restricted area for employees, click to <a href="/logout">logout</a>');
});

app.get('/veryrestricted', restrictSupervisor, function(req, res){
	res.send('Wahoo! restricted area for supervisors, click to <a href="/logout">logout</a>');
});

// Employee page
app.get('/employee', restrict, function(req, res) {
	res.render('employee');
});

// Employee/supervisor functions
app.get('/allschedules', restrictSupervisor, function(req, res) {
	var result = [];
	var stmt1 = db.prepare('SELECT schedule.employee_id, employee.first_name, employee.last_name, employee.email_address, start_time, end_time, repeat, schedule.site_id, site_name, address, city, state, zip, latitude, longitude FROM schedule INNER JOIN site ON schedule.site_id = site.site_id, employee ON schedule.employee_id = employee.employee_id');
	stmt1.each([], (err1, row) => {
		result.push(row);
	}, (err2, count1) => {
		console.log('Finalize employee schedule list ('+count1+')');
		stmt1.finalize();
		if (count1 == 0) {
			// Nothing special, but the result will be empty
		}
		res.send(result);
	});
});

app.get('/allshifts', restrictSupervisor, function(req, res) {
	var result = [];
	var stmt1 = db.prepare('SELECT shift.employee_id, employee.first_name, employee.last_name, employee.email_address, clock_in_time, clock_out_time, shift.site_id, site_name, address, city, state, zip, site.latitude, site.longitude, latitude_in, latitude_out, longitude_in, longitude_out FROM shift INNER JOIN site ON shift.site_id = site.site_id, employee ON shift.employee_id = employee.employee_id');
	stmt1.each([], (err1, row) => {
		result.push(row);
	}, (err2, count1) => {
		console.log('Finalize employee checkin list ('+count1+')');
		stmt1.finalize();
		if (count1 == 0) {
			// Nothing special, but the result will be empty
		}
		res.send(result);
	});
});

app.get('/schedule', restrict, function(req, res) {
	if (req.session.user.isSupervisor) {
		var result = [];
		var stmt1 = db.prepare('SELECT start_time, end_time, repeat, schedule.site_id, site_name, address, city, state, zip, latitude, longitude FROM schedule INNER JOIN site ON schedule.site_id = site.site_id WHERE schedule.employee_id = ?');
		stmt1.each(req.query.employee_id, (err1, row) => {
			result.push(row);
		}, (err2, count1) => {
			console.log('Finalize employee schedule ('+count1+') [supervisor]');
			stmt1.finalize();
			if (count1 == 0) {
				// Nothing special, but the result will be empty
			}
			res.send(result);
		});
	}
	else {
		var result = [];
		var stmt1 = db.prepare('SELECT start_time, end_time, repeat, site.site_id, site_name, address, city, state, zip, latitude, longitude FROM schedule INNER JOIN site ON schedule.site_id = site.site_id WHERE schedule.employee_id = ?');
		stmt1.each(req.session.user.employee_id, (err1, row) => {
			result.push(row);
		}, (err2, count1) => {
			console.log('Finalize employee schedule ('+count1+')');
			stmt1.finalize();
			if (count1 == 0) {
				// Nothing special, but the result will be empty
			}
			res.send(result);
		});
	}
});

app.get('/status', restrict, function(req, res) {
	var stmt1 = db.prepare('SELECT * FROM shift WHERE employee_id = ? AND clock_out_time IS NULL');
	stmt1.each(req.session.user.employee_id, (err1, row) => {
		//Maybe nothing needed. But probably should add something to account for people who never checked out... Like a time-based check. Overtime of a whole day is a bit sus
	}, (err2, count1) => {
		console.log('Finalize employee status ('+count1+')');
		stmt1.finalize();
		if (err2) {
			res.send(false);
		}
		else {
			if (count1 > 0) {
				res.send(true);
			}
			else {
				res.send(false);
			}
		}
	});
});

app.get('/checkin', restrict, function(req, res) {
	// Assumes check in is valid...
	db.run("INSERT INTO shift (employee_id, site_id, clock_in_time, latitude_in, longitude_in) VALUES (?, ?, DATETIME('now'), ?, ?)",
		[req.session.user.employee_id, req.query.site_id, req.query.latitude_in, req.query.longitude_in], function(err) {
		if (err) {
			res.send('error');
		}
		else {
			res.send('success');
		}
	});
});

app.get('/checkout', restrict, function(req, res) {
	// First query to make sure there is only one record, then update it using the ID
	var shift_id;
	var stmt1 = db.prepare('SELECT * FROM shift WHERE employee_id = ? AND clock_out_time IS NULL');
	stmt1.each(req.session.user.employee_id, (err1, row) => {
		shift_id = row.shift_id;
	}, (err2, count1) => {
		if (count1 == 0 || err2) {
			res.send(false);
		}
		else {
			db.run("UPDATE shift SET clock_out_time = DATETIME('now'), latitude_out = ?, longitude_out = ? WHERE shift_id = ?", 
				[req.query.latitude_out, req.query.longitude_out, shift_id], function(err) {
				if (err) {
					res.send('error');
				}
				else {
					res.send('success');
				}
			});
		}
	});
});

// Supervisor page
app.get('/supervisor', restrictSupervisor, function(req, res) {
	res.render('supervisor');
});

// Supervisor functions (TODO)

// Login / Logout
app.get('/logout', function(req, res){
  // destroy the user's session to log them out
  // will be re-created next request
  req.session.destroy(function(){
    res.redirect('/');
  });
});

app.get('/login', function(req, res){
  res.render('login');
});

app.post('/login', function(req, res){
  authenticate(req.body.username, req.body.password, function(err, user, isSupervisor){
    if (user) {
      // Regenerate session when signing in
      // to prevent fixation
      req.session.regenerate(function(){
        // Store the user's primary key
        // in the session store to be retrieved,
        // or in this case the entire user object
        req.session.user = user;
        req.session.success = 'Authenticated as ' + user.first_name + ' ' + user.last_name + ' (' + user.email_address + ').'
          + ' click to <a href="/logout">logout</a>. '
          + ' You may now access <a href="/restricted">/restricted</a>.';
		req.session.isSupervisor = isSupervisor;
		
		if (isSupervisor) {
			res.redirect('/supervisor')
		}
		else {
			res.redirect('/employee')
		}
        //res.redirect('back');
      });
    } else {
      req.session.error = 'Authentication failed, please check your '
        + ' username and password.';
      res.redirect('/login');
    }
  });
});

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;

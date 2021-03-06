
Scoped.define("module:TimeFormat", ["module:Time", "module:Strings", "module:Objs"], function (Time, Strings, Objs) {
	/**
	 * Module for formatting Time / Date
	 * 
	 * @module BetaJS.TimeFormat
	 */
	return {
		
		/*
			HH	Hours; leading zero for single-digit hours (24-hour clock).
			H	Hours; no leading zero for single-digit hours (24-hour clock).
			h+  Hours; hours as absolute number
			hh	Hours; leading zero for single-digit hours (12-hour clock).
			h	Hours; no leading zero for single-digit hours (12-hour clock).
			M+  Minutes; minutes as absolute number
			MM	Minutes; leading zero for single-digit minutes.
			M	Minutes; no leading zero for single-digit minutes.
			s+	Seconds; seconds as absolute number
			ss	Seconds; leading zero for single-digit seconds.
			s	Seconds; no leading zero for single-digit seconds.
			mmm	Month as a three-letter abbreviation.
			mm	Month as digits; leading zero for single-digit months.
			m	Month as digits; no leading zero for single-digit months.
			d+	Days; days as absolute number
			ddddDay of the week as string.
			ddd	Day of the week as a three-letter abbreviation.
			dd	Day of the month as digits; leading zero for single-digit days.
			d	Day of the month as digits; no leading zero for single-digit days.
			yy	Year as last two digits; leading zero for years less than 10.
			yyyyYear represented by four digits.
			l+  Milliseconds; absolute
			l   Milliseconds 3 digits
			L   Milliseconds 2 digits
			t	Lowercase, single-character time marker string: a or p.
			tt	Lowercase, two-character time marker string: am or pm.
			T	Uppercase, single-character time marker string: A or P.
			TT	Uppercase, two-character time marker string: AM or PM.
			o	GMT/UTC timezone offset, e.g. -0500 or +0230.
			
		*/
		
		formatMappings: {
			"HH": function (t) {
				return Strings.padZeros(Time.timeModulo(t, "hour", "floor"), 2);
			},
			"H": function (t) {
				return Time.timeModulo(t, "hour", "floor");
			},
			"h+": function (t) {
				return Time.timeComponent(t, "hour", "floor");
			},
			"hh": function (t) {
				var h = Time.timeModulo(t, "hour", "floor");
				h = h === 0 ? 12 : (h > 12 ? h - 12 : h);
				return Strings.padZeros(h, " ", 2);
			},
			"h": function (t) {
				var h = Time.timeModulo(t, "hour", "floor");
				h = h === 0 ? 12 : (h > 12 ? h - 12 : h);
				return h;
			},
			"M+": function (t) {
				return Time.timeComponent(t, "minute", "floor");
			},
			"MM": function (t) {
				return Strings.padZeros(Time.timeModulo(t, "minute", "floor"), 2);
			},
			"M": function (t) {
				return Time.timeModulo(t, "minute", "floor");
			},
			"s+": function (t) {
				return Time.timeComponent(t, "second", "floor");
			},
			"ss": function (t) {
				return Strings.padZeros(Time.timeModulo(t, "second", "floor"), 2);
			},
			"s": function (t) {
				return Time.timeModulo(t, "second", "floor");
			},
			"mmm": function (t) {
				return ((new Date(t)).toUTCString().split(" "))[2];
			},
			"mm": function (t) {
				return Strings.padZeros(Time.timeComponentGet(t, "month"), 2);
			},
			"m": function (t) {
				return Time.timeComponentGet(t, "month");
			},
			"d+": function (t) {
				return Time.timeComponent(t, "day", "floor");
			},
			"dddd": function (t) {
				var map = {2: "s", 3: "nes", 4: "rs", 6: "ur"};
				return (new Date(t)).toUTCString().substring(0,3) + (map[Time.timeComponentGet(t, "weekday")] || "") + "day";
			},
			"ddd": function (t) {
				return (new Date(t)).toUTCString().substring(0,3);
			},
			"dd": function (t) {
				return Strings.padZeros(Time.timeComponentGet(t, "day"), 2);
			},
			"d": function (t) {
				return Time.timeComponentGet(t, "day") + 1;
			},
			"yyyy": function (t) {
				return Time.timeComponentGet(t, "year");
			},
			"yy": function (t) {
				return Time.timeComponentGet(t, "year") % 100;
			},
			"l+": function (t) {
				return t;
			},
			"l": function (t) {
				return Time.timeComponent(t, "millisecond", "floor");
			},
			"L": function (t) {
				return Time.timeComponent(t, "millisecond", "floor") % 10;
			},
			"tt": function (t) {
				return Time.timeModulo(t, "hour", "floor") < 12 ? 'am' : 'pm';
			},
			"t": function (t) {
				return Time.timeModulo(t, "hour", "floor") < 12 ? 'a' : 'p';
			},
			"TT": function (t) {
				return Time.timeModulo(t, "hour", "floor") < 12 ? 'AM' : 'PM';
			},
			"T": function (t) {
				return Time.timeModulo(t, "hour", "floor") < 12 ? 'A' : 'P';
			},
			"o": function (t, bias) {
				bias = Math.floor(bias / 1000 / 60);
				return (bias > 0 ? "-" : "+") + Strings.padZeros(Math.floor(Math.abs(bias) / 60) * 100 + Math.abs(bias) % 60, 4);
			}
			
		},
		
		ELAPSED_HOURS_MINUTES_SECONDS: "h+:MM:ss",
		ELAPSED_MINUTES_SECONDS: "M+:ss",
		FULL_YEAR: "yyyy",
		LETTER_MONTH: "mmm",
		LETTER_MONTH_AND_DAY: "mmm d",
		WEEKDAY: "ddd",
		HOURS_MINUTES_TT: "hh:MM tt",
		
		
		/**
		 * Format a given time w.r.t. a given time format
		 * 
		 * @param {string} timeFormat a time format string
		 * @param {int} time time as integer to be formatted
		 * @param {int} timezone timezone bias (optional)
		 * @return {string} formatted time
		 * 
		 */
		format: function (timeFormat, time, timezone) {
			var timezoneTime = Time.timeToTimezoneBasedDate(time, timezone);
			var bias = Time.timezoneBias(timezone);
			var result = timeFormat;
			var replacers = [];			
			Objs.iter(this.formatMappings, function (formatter, key) {
				if (result.indexOf(key) >= 0) {
					var i = replacers.length;
					replacers.push(formatter(timezoneTime, bias));
					result = result.replace(key, "$" + i + "$");
				}
			}, this);
			for (var i = 0; i < replacers.length; ++i)
				result = result.replace("$" + i + "$", replacers[i]);
			return result;
		},
		
		/**
		 * Format the month as a three letter string
		 * 
		 * @param {int} month month as an int
		 * @return {string} three letter month string
		 */
		monthString: function (month) {
			return this.format("mmm", Time.encodePeriod({month: month}));			
		},
		
		/**
		 * Format the weekday as a three letter string
		 * 
		 * @param {int} weekday weekday as an int
		 * @return {string} three letter weekday string
		 */
		weekdayString: function (weekday) {
			return this.format("ddd", Time.encodePeriod({weekday: weekday}));
		},
		
		/**
		 * Format most significant part of date / time relative to current time
		 * 
		 * @param {int} time date/time to be formatted
		 * @param {int} currentTime relative to current time (optional)
		 * @param {int} timezone time zone bias (optional)
		 * @return {string} formatted time
		 */
		formatRelativeMostSignificant: function (time, currentTime, timezone) {
			currentTime = currentTime || Time.now();
			var t = Time.decodeTime(time, timezone);
			var c = Time.decodeTime(currentTime, timezone);
			// Same day. Return time.
			if (t.year === c.year && t.month === c.month && t.day === c.day)
				return this.format(this.HOURS_MINUTES_TT, time, timezone);
			// Less than 7 days. Return week day.
			if (currentTime - time < 7 * 24 * 60 * 60 * 1000 && t.weekday !== c.weekday)
				return this.format(this.WEEKDAY, time, timezone);
			// Last 2 months?
			if ((t.year === c.year && t.month + 1 >= c.month) || (t.year + 1 === c.year && t.month + 1 >= c.month + 12 - 1))
				return this.format(this.LETTER_MONTH_AND_DAY, time, timezone);
			// Last 11 month?
			if (t.year === c.year || (t.year + 1 === c.year && t.month > c.month))
				return this.format(this.LETTER_MONTH, time, timezone);
			// Return year
			return this.format(this.FULL_YEAR, time, timezone);
		}
		
	};
});
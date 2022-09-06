/* eslint-disable unicorn/filename-case */
/* eslint-disable no-underscore-dangle */
const crypto = require('crypto');

// eslint-disable-next-line global-require
const debug = require('debug')(`${require('../package.json').name}:cursor`);

/**
 * Return a random alphanumerical string of length len
 * There is a very small probability (less than 1/1,000,000) for the length to be less than len
 * (il the base64 conversion yields too many pluses and slashes) but
 * that's not an issue here
 * The probability of a collision is extremely small (need 3*10^12 documents to have one chance in a million of a collision)
 * See http://en.wikipedia.org/wiki/Birthday_problem
 */
function uid(len) {
  return crypto
    .randomBytes(Math.ceil(Math.max(8, len * 2)))
    .toString('base64')
    .replace(/[+\/]/g, '') // eslint-disable-line
    .slice(0, len);
}

function isMongoose() {
  return !!global.MONGOOSE_DRIVER_PATH;
}

function isMongoId(input) {
  return typeof input === 'object' && input.constructor && input.constructor.name === 'ObjectID';
}

// To make cursor work with mongoose
function adaptToMongoose(cursor, options) {
  if (!options) {
    return cursor;
  }

  const projectionKeys = Object.keys(options);
  const isMongooseOptions = projectionKeys.every((x) => ['limit', 'skip', 'sort', 'fields'].includes(x));

  if (isMongoose() && isMongooseOptions) {
    if (options.fields) {
      const isPureSelection = Object.values(options.fields).every((x) => typeof x !== 'object');
      if (isPureSelection) {
        cursor.projection(options.fields);
      } else {
        // FIXME: the merging from projection to query conditions may cause new problems
        debug('merge projection into query', { query: cursor.query, fields: options.fields });
        cursor.query = Object.assign({}, cursor.query, options.fields);
      }
    }

    if (options.sort && typeof options.sort === 'object') {
      cursor.sort(options.sort);
    }
    if (typeof options.skip === 'number') {
      cursor.skip(options.skip);
    }
    if (typeof options.limit === 'number') {
      cursor.limit(options.limit);
    }
  } else {
    cursor.projection(options);
  }

  return cursor;
}

function convertObjectIdToString(obj) {
  if (!isMongoose()) {
    return;
  }

  if (!obj) {
    return;
  }

  if (typeof obj !== 'object') {
    return;
  }

  const doConvert = (o) => {
    if (Array.isArray(o)) {
      o.forEach((x, i) => {
        if (!x) {
          return;
        }

        if (isMongoId(x)) {
          o[i] = x.toString();
          return;
        }

        if (typeof x === 'object') {
          convertObjectIdToString(x);
        }
      });

      return;
    }

    const keys = Object.keys(o);
    keys.forEach((key) => {
      if (!o[key]) {
        return;
      }

      if (isMongoId(o[key])) {
        o[key] = o[key].toString();
        return;
      }

      convertObjectIdToString(o[key]);
    });
  };

  if (typeof obj.toObject === 'function' && typeof obj._doc === 'object') {
    doConvert(obj._doc);
  } else {
    doConvert(obj);
  }
}

// Interface
module.exports.uid = uid;
module.exports.isMongoose = isMongoose;
module.exports.isMongoId = isMongoId;
module.exports.adaptToMongoose = adaptToMongoose;
module.exports.convertObjectIdToString = convertObjectIdToString;

const _ = require('lodash');

module.exports = function normalizeWhereClause(_whereClause, meta) {
  // Clone the where clause so that we don't modify the original query object.
  const whereClause = _.cloneDeep(_whereClause);

  return (function transformBranch(branch) {
    const loneKey = _.first(_.keys(branch));
    const val = branch[loneKey];

    if (loneKey === 'and' || loneKey === 'or') {
      branch[`$${loneKey}`] = _.map(val, transformBranch);
      delete branch[loneKey];
      return branch;
    }

    if (!_.isObject(val)) {
      return branch;
    }

    const modifier = _.first(_.keys(val));
    const modified = val[modifier];
    delete val[modifier];

    switch (modifier) {
      case '<':
        val.$lt = modified;
        break;

      case '<=':
        val.$lte = modified;
        break;

      case '>':
        val.$gt = modified;
        break;

      case '>=':
        val.$gte = modified;
        break;

      case '!=':
        // To bring sails-disk more in line with MongoDB's treatment of empty arrays,
        // we'll explicitly check if we're doing `{ foo: {'!=': null} }` and transform it into
        // { $or: [ { foo: { '$ne': null } }, { foo: { '$size': 0 } } ] }
        // That way records where `foo` is an empty array will match the query.
        if (modified === null) {
          delete branch[loneKey];
          branch.$or = (() => {
            const or = [];
            const ne = {};
            const size = {};
            ne[loneKey] = { $ne: modified };
            size[loneKey] = { $size: 0 };
            or.push(ne);
            or.push(size);
            return or;
          })();
        } else {
          val.$ne = modified;
        }
        break;

      case 'nin':
        val.$nin = modified;
        break;

      case 'in':
        val.$in = modified;
        break;

      case 'like':
        // eslint-disable-next-line no-case-declarations
        const regexpAsString = `^${_.escapeRegExp(modified)
          .replace(/^%/, '.*')
          .replace(/([^\\])%/g, '$1.*')
          .replace(/\\%/g, '%')}$`;

        if (meta && meta.makeLikeModifierCaseInsensitive) {
          val.$regex = new RegExp(regexpAsString, 'i');
        } else {
          val.$regex = new RegExp(regexpAsString);
        }
        break;

      default:
        throw new Error(`Consistency violation: where-clause modifier \`${modifier}\` is not valid!`);
    }

    return branch;
  })(whereClause);
};

'use strict';
// Turns a web of objects, such as a level run whose cells point at their creature and at their cell type, into plain
// JSON data and back, keeping shared objects shared and loops intact (pure).
//
// The encoding: strings, booleans, null and finite numbers stay as they are. A number JSON can't hold exactly is
// { $number: 'NaN' | 'Infinity' | '-Infinity' | '-0' }, and undefined is { $undefined: 1 }. An object, array, Map or
// Set met for the first time is { $id, $object | $array | $map | $set }; met again, it is { $ref: id }. One of the
// game's data objects (a cell type, a level) is { $data: 'CELLS.mouth' }, so that it comes back as the same object.

const SPECIAL_NUMBERS = { NaN: NaN, Infinity: Infinity, '-Infinity': -Infinity, '-0': -0 };

// Gives every object inside the data tables ({ CELLS, LEVELS, … }) a path, such as 'CELLS.mouth.recipe', both ways.
function indexDataObjects(tables) {
  const pathByObject = new Map();
  const objectByPath = new Map();
  const visit = (value, path) => {
    if (!value || typeof value !== 'object' || pathByObject.has(value)) return;
    pathByObject.set(value, path);
    objectByPath.set(path, value);
    for (const [key, child] of Object.entries(value)) visit(child, path + '.' + key);
  };
  for (const [name, table] of Object.entries(tables)) visit(table, name);
  return { pathByObject, objectByPath };
}

// the number as JSON keeps it: itself, or a { $number } for the values JSON would change
function encodeNumber(value) {
  if (Object.is(value, -0)) return { $number: '-0' };
  return Number.isFinite(value) ? value : { $number: String(value) };
}

// Plain JSON data for root (see the top of the file); dataIndex comes from indexDataObjects. A function or an
// object of another class can't be kept, and throws, naming where it was found.
function takeSnapshot(root, dataIndex) {
  const idByObject = new Map();
  const encode = (value, path) => {
    if (typeof value === 'number') return encodeNumber(value);
    if (value === undefined) return { $undefined: 1 };
    if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
    if (typeof value !== 'object') throw new Error(`can't keep a ${typeof value} at ${path}`);
    if (dataIndex.pathByObject.has(value)) return { $data: dataIndex.pathByObject.get(value) };
    if (idByObject.has(value)) return { $ref: idByObject.get(value) };
    const id = idByObject.size;
    idByObject.set(value, id);
    if (Array.isArray(value)) return { $id: id, $array: value.map((item, i) => encode(item, `${path}[${i}]`)) };
    const kind = Object.prototype.toString.call(value);   // not instanceof: a Set made in another realm counts
    if (kind === '[object Map]') {
      const entries = [...value].map(([key, item]) => [encode(key, path), encode(item, `${path}.get(${key})`)]);
      return { $id: id, $map: entries };
    }
    if (kind === '[object Set]') return { $id: id, $set: [...value].map(item => encode(item, path)) };
    if (kind !== '[object Object]' || !isPlainObject(value)) throw new Error(`can't keep a class instance at ${path}`);
    const fields = {};
    for (const [key, item] of Object.entries(value)) fields[key] = encode(item, path + '.' + key);
    return { $id: id, $object: fields };
  };
  return encode(root, 'root');
}

// whether an object is a plain { } (of any realm), not an instance of a class
const isPlainObject = value => {
  const prototype = Object.getPrototypeOf(value);
  return prototype === null || Object.getPrototypeOf(prototype) === null;
};

// The objects takeSnapshot encoded, rebuilt. Every container is registered before its contents are read, so a
// { $ref } inside it to itself or to an outer object finds it.
function restoreSnapshot(encoded, dataIndex) {
  const objectById = new Map();
  const decode = value => {
    if (value === null || typeof value !== 'object') return value;
    if ('$number' in value) return SPECIAL_NUMBERS[value.$number];
    if ('$undefined' in value) return undefined;
    if ('$data' in value) return dataObjectAt(dataIndex, value.$data);
    if ('$ref' in value) return objectById.get(value.$ref);
    if ('$array' in value) {
      const array = [];
      objectById.set(value.$id, array);
      for (const item of value.$array) array.push(decode(item));
      return array;
    }
    if ('$map' in value) {
      const map = new Map();
      objectById.set(value.$id, map);
      for (const [key, item] of value.$map) map.set(decode(key), decode(item));
      return map;
    }
    if ('$set' in value) {
      const set = new Set();
      objectById.set(value.$id, set);
      for (const item of value.$set) set.add(decode(item));
      return set;
    }
    const object = {};
    objectById.set(value.$id, object);
    for (const [key, item] of Object.entries(value.$object)) object[key] = decode(item);
    return object;
  };
  return decode(encoded);
}

// the data object at a path; a path the game no longer has (a removed cell type) can't be restored
function dataObjectAt(dataIndex, path) {
  if (!dataIndex.objectByPath.has(path)) throw new Error(`the game has no ${path} any more`);
  return dataIndex.objectByPath.get(path);
}

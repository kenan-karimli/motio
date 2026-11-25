import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nameFrom } from '../src/placename.js';

test('a place name beats the street, the street beats the district', () => {
  assert.equal(nameFrom({ name: 'Port Baku Mall', addresstype: 'shop', address: { road: 'Neftchilar Avenue' } }), 'Port Baku Mall');
  assert.equal(nameFrom({ name: 'Neftchilar Avenue', addresstype: 'road', address: { road: 'Neftchilar Avenue', house_number: '151', suburb: 'Sabail' } }), 'Neftchilar Avenue 151');
  assert.equal(nameFrom({ address: { suburb: 'Sabail', city: 'Baku' } }), 'Sabail');
  assert.equal(nameFrom({}), '');
});

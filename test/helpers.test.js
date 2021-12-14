const test = require('ava')
const { getFileFormat, getFileType, format } = require('../lib/helpers')

test('Should return "images" text', (t) =>
  t.is(getFileFormat({ ext: '.webp' }), 'images'))

test('Should return "videos" text', (t) =>
  t.is(getFileFormat({ ext: '.mp4' }), 'videos'))

test('Should return "files" text', (t) =>
  t.is(getFileFormat({ ext: '.pdf' }), 'files'))

test('Should return "files" text when ext is empty', (t) =>
  t.is(getFileFormat({ ext: '' }), 'files'))

test('Should return "origin" text', (t) =>
  t.is(getFileType({ hash: '' }), 'origin'))

test('Should return "thumbnail" text', (t) =>
  t.is(getFileType({ hash: 'thumbnail_name.ext' }), 'thumbnail'))

test('Format string with single parameters', (t) =>
  t.is(format('replace {0}', ['text']), 'replace text'))

test('Format string with multiple parameters', (t) =>
  t.is(
    format('replace {0} {1} {2} {3}', ['multiple', 'params', 'in', 'string']),
    'replace multiple params in string',
  ))

function getFileType(file) {
  let fileType = 'origin'
  if (file.hash.split('_')[0] === 'thumbnail') fileType = 'thumbnail'

  return fileType
}

function getFileFormat(file) {
  const extension = file.ext.toLowerCase()
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.tiff']
  const videoExtensions = ['.mp4', '.mkv', '.webm']

  if (imageExtensions.includes(extension)) return 'images'
  else if (videoExtensions.includes(extension)) return 'videos'

  return 'files'
}

function format(text, parameters) {
  return text.replace(/{(\d+)}/g, (match, number) => {
    return parameters[number] ?? match
  })
}

function isEmptyObject(object) {
  if (!object) return true
  return Object.entries(object).length === 0
}

module.exports = { getFileType, getFileFormat, format, isEmptyObject }

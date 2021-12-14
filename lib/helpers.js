function getFileType(file) {
  let fileType = 'origin'
  if (file.hash.split('_')[0] === 'thumbnail') fileType = 'thumbnail'

  return fileType
}

function getFileFormat(file) {
  const extension = file.ext.toLowerCase()
  const imageExtensions = ['jpg', 'jpeg', 'png', 'webp', 'tiff']
  const videoExtensions = ['mp4', 'mkv', 'webm']

  if (imageExtensions.contains(extension)) return 'images'
  else if (videoExtensions.contains(extension)) return 'videos'

  return 'files'
}

function format(text, parameters) {
  return text.replace(/{(\d+)}/g, (match, number) => {
    return typeof parameters[number] !== 'undefined'
      ? parameters[number]
      : match
  })
}

module.exports = { getFileType, getFileFormat, format }

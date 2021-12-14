const AWS = require('aws-sdk')
const Sharp = require('sharp')
const { map, each } = require('async')

const { getFileType, getFileFormat, format } = require('./helpers')

async function generateThumbnails(file, sizes, optimizeOptions) {
  return map(sizes, async ({ name, resizeOptions }) => {
    let buffer = file.buffer
    const path = `images/${name}/${file.hash}.webp`

    let sharp = Sharp(file.buffer)
    if (file.ext !== '.webp') sharp = sharp.toFormat('webp')

    buffer = await sharp
      .webp(optimizeOptions)
      .resize(resizeOptions || {})
      .rotate()
      .toBuffer()

    strapi.log.info(`🔄 Generated ${path}`)

    return { buffer, path, mime: 'image/webp' }
  })
}

function getS3BaseUrl({ cdn, params, region }) {
  if (cdn) return cdn

  return format('https://{0}.{1}.digitaloceanspaces.com', [
    params.Bucket,
    region,
  ])
}

function getS3Instance(config) {
  const spacesEndpoint = new AWS.Endpoint(config.endpoint)

  return new AWS.S3({
    apiVersion: '2006-03-01',
    ...config,
    endpoint: spacesEndpoint,
  })
}

const upload = ({ imageSizes, optimizeOptions, ...config }) => {
  return async (file, customParameters = {}) => {
    const fileType = getFileType(file)
    const fileFormat = getFileFormat(file)

    let buffers = []
    let origin = file.buffer
    let path = `${fileFormat}/${file.hash}.webp`

    if (fileFormat === 'images') {
      let sharp = Sharp(file.buffer)
      if (file.ext !== '.webp') sharp = sharp.toFormat('webp')
      origin = await sharp.webp(optimizeOptions.webp).rotate().toBuffer()
      path = `${fileFormat}/${fileType}/${file.hash}${file.ext}`
    }

    buffers.push({
      buffer: origin,
      path,
      mime: 'image/webp',
      isOrigin: true,
    })

    if (fileType !== 'thumbnail') {
      const thumbs = await generateThumbnails(
        file,
        imageSizes,
        optimizeOptions.webp,
      )
      buffers = [...buffers, ...thumbs]
    }

    const S3 = getS3Instance(config)
    await each(buffers, async (item) => {
      await S3.upload({
        Key: item.path,
        Body: Buffer.from(item.buffer),
        ACL: 'public-read',
        ContentType: item.mime,
        ...customParameters,
      }).promise()

      strapi.log.info(`✅ Uploaded ${item.path}`)
    })

    file.url = `${getS3BaseUrl(config)}/${path}`
  }
}

const destroy = ({ ...config }) => {
  return async (file, customParameters = {}) => {
    const fileType = getFileType(file)
    const fileFormat = getFileFormat(file)

    const paths = {
      images: `images/${fileType}/${file.hash}${file.ext}`,
      videos: `videos/${file.hash}${file.ext}`,
      files: `files/${file.hash}${file.ext}`,
    }

    const S3 = getS3Instance(config)

    const path = paths[fileFormat]
    await S3.deleteObject({ Key: path, ...customParameters }).promise()

    strapi.log.info(`❌ Deleted ${path}`)
  }
}

module.exports = {
  init: (providerOptions) => ({
    upload: upload(providerOptions),
    delete: destroy(providerOptions),
  }),
}

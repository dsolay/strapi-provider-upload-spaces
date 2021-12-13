const upload = (file) => {}

const destroy = (file) => {}

module.exports = {
  init({ imageSizes, optimizeOptions, settings, ...config }) {

    console.log(config)
    return {
      upload,
      delete: destroy,
    }
  },
}


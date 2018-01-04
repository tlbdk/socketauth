function parseSshOptions(args) {
  let sshOptions = {}
  let lastOption = null
  let username = process.env['USER']
  let hostname = null
  let commandOptions = []
  for (let arg of args) {
    let match
    if (hostname !== null) {
      commandOptions.push(arg)
    } else if (lastOption !== null) {
      if (lastOption === 'l') {
        username = arg
      }
      sshOptions[lastOption] = arg
      lastOption = null
    } else if (
      (match = arg.match(
        /^-([46AaCfGgKkMNnqsTtVvXxYy]+)?([bcdEeFIiJLlmOopQRSWw])?$/
      ))
    ) {
      let singleOptions = (match[1] === undefined ? '' : match[1]).split('')
      for (let opt of singleOptions) {
        sshOptions[opt] = true
      }
      if (match[2] !== undefined) {
        lastOption = match[2]
      }
    } else if ((match = arg.match(/^(?:([^@]+)@)?(.+)$/))) {
      username = match[1] !== undefined ? match[1] : username
      hostname = match[2]
    }
  }
  return {
    username,
    hostname,
    sshOptions,
    commandOptions
  }
}

function parseGitSshCommand(args) {
  let command = null
  let repo = null
  if (args.length === 2) {
    let match
    if (
      (match = args[0].match(
        /^(git-upload-pack|git-receive-pack|git-upload-archive)$/
      ))
    ) {
      command = match[1]
      if ((match = args[1].match(/'?(.+?)(?:\/|(?:\.git))?'?$/))) {
        repo = match[1]
      }
    }
  }
  return {
    command,
    repo
  }
}

module.exports = { parseSshOptions, parseGitSshCommand }

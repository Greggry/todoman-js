const readline = require('readline');
const fs = require('fs/promises');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// promisify rl.question()
function prompt(questionString) {
  return new Promise(resolve => {
    rl.question(questionString, answer => {
      resolve(answer);
    });
  });
}

// promisify setTimeout()
function wait(seconds) {
  return new Promise(resolve => {
    setTimeout(() => resolve(), seconds * 1000); // convert ms -> s
  });
}

const OPTIONS = `
1. new todo
2. mark done/undone
3. delete
4. quit`;

const format = string => string.toLowerCase().trim();

const isAnyFormattedOutputMatching = (valueToCompareWith, ...args) => {
  const formattedOutput = format(valueToCompareWith);

  return args.some(item => formattedOutput === format(item));
};

class TodoList {
  todoListContents;
  todoFileName;

  constructor(filename) {
    this.todoFileName = filename;

    return (async () => {
      try {
        // load the todoList
        const fileHandle = await fs.open(filename, 'r');
        this.todoListContents = await fileHandle.readFile({ encoding: 'utf-8' });
        fileHandle.close();
      } catch (e) {
        console.log(e);
        process.exit(1);
      }

      return this;
    })();
  }

  log() {
    if (this.todoListContents === '') {
      console.log('no todo items');
      return;
    }

    // console.log the items, adding numbers and skipping everything after hashes
    this.todoListContents
      .trim()
      .split('\n')
      .forEach((line, i) => {
        const lastHashIndex = line.lastIndexOf('#');

        console.log(`${i}: ${line.substr(0, lastHashIndex)}`);
      });
  }

  saveFile() {
    return (async () => {
      try {
        // load the todoList
        const fileHandle = await fs.open(this.todoFileName, 'w');

        fileHandle.writeFile(this.todoListContents);

        fileHandle.close();
      } catch (e) {
        console.log(e);
        process.exit(1);
      }
    })();
  }

  newTodo(todoName) {
    const date = new Date().toLocaleString('en-US');

    this.todoListContents += `[ ] ${todoName} # ${date}\n`;
  }

  markTodo(line) {
    // a todo starts with '[ ]' or '[x]'
    const doMarkUndone = line[1] === 'x'; // already marked done

    if (doMarkUndone) {
      this.todoListContents = this.todoListContents.replace(line, line.replace('[x]', '[ ]'));
      return;
    }

    // mark as done
    this.todoListContents = this.todoListContents.replace(line, line.replace('[ ]', '[x]'));
  }

  deleteTodo(line) {
    // remove the string line from this.todoListContents
    this.todoListContents = this.todoListContents.replace(`${line}\n`, '');
  }
}

(async () => {
  const todoList = await new TodoList('todo.txt');

  while (true) {
    console.clear();
    todoList.log();

    const answer = await prompt(`${OPTIONS}\n: `);
    if (isAnyFormattedOutputMatching(format(answer), '4', '4.', 'quit')) break;

    switch (format(answer)) {
      case '1':
      case '1.':
      case 'new':
      case 'todo':
        const todoName = await prompt('Name for the new todo: ');
        todoList.newTodo(todoName);
        break;

      case '2':
      case '2.':
      case 'mark':
      case 'done':
      case 'undone':
      case 'done':
        const lineNumberToMark = await prompt('Number of the todo to check/uncheck: ');
        console.log(todoList.todoListContents.trim().split('\n'));
        // TODO remake the numbering to be done internally within the program
        const lineStringToMark = todoList.todoListContents.trim().split('\n')[lineNumberToMark]; // assuming we start todos from 0

        if (!lineStringToMark) await prompt('Argument out of range.');
        else todoList.markTodo(lineStringToMark);

        break;

      case '3':
      case '3.':
      case 'delete':
        const lineNumberToDelete = await prompt('Number of the todo to delete: ');
        const lineString = todoList.todoListContents.trim().split('\n')[lineNumberToDelete];

        if (!lineString) await prompt('Argument out of range.');
        else {
          const confirm = await prompt(`Delete '${lineString}' ? [y/N]: `);
          if (isAnyFormattedOutputMatching(confirm, 'yes', 'y')) todoList.deleteTodo(lineString);
        }
        break;

      default:
        await prompt('Not a valid argument!');
        console.clear();
    }
  }

  todoList.saveFile();

  console.log('Exiting...');
  await wait(0.5);

  rl.close();
})();

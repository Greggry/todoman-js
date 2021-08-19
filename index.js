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
1. [n]ew todo
2. [x] mark done/undone
3. [d]elete
4. [q]uit`;

const format = string => string.toLowerCase().trim();

const isAnyFormattedOutputMatching = (valueToCompareWith, ...args) => {
  const formattedOutput = format(valueToCompareWith);

  return args.some(item => formattedOutput === format(item));
};

class TodoList {
  todoFileName;

  constructor(filename) {
    this.todoFileName = filename;

    return (async () => {
      try {
        // load the todoList

        const fileHandle = await fs.open(filename, 'a+'); // open for appending and reading so the file is created if it doesn't exist
        const fileContents = await fileHandle.readFile({ encoding: 'utf-8' });
        fileHandle.close();

        this.initTodoList(fileContents);
      } catch (e) {
        console.log(e);
        process.exit(1);
      }

      return this;
    })();
  }

  initTodoList(fileContents) {
    // structure
    /* todoList = [
      {item1Time, item1State, item1Task},
      {item2Time, item2State, item2Task},
    ]
    */

    const todoList = [];

    // loop over the string list and add to the returned array
    fileContents
      .trim()
      .split('\n')
      .forEach(line => {
        if (line === '') return; // case when the file is empty

        const lastHashIndex = line.lastIndexOf('#');

        // format: '[x] some task # mm/dd/yyyy, hh:mm:mm AM/PM'
        const isDone = line[1] === 'x' ? true : false;
        const task = line.substring(4, lastHashIndex - 1);
        const date = new Date(line.substring(lastHashIndex));

        todoList.push({ isDone, task, date });
      });

    this.todoList = todoList;
  }

  log() {
    if (this.todoList.length === 0) {
      console.log('no todo items');
      return;
    }

    this.todoList.forEach((todo, i) => {
      console.log(`${i}: [${todo.isDone ? 'x' : ' '}] ${todo.task}`);
    });
  }

  saveFile() {
    // save the current todos as a readable string
    const stringToWrite = this.todoList.reduce((acc, todo) => {
      return acc + `[${todo.isDone ? 'x' : ' '}] ${todo.task} # ${todo.date}\n`;
    }, '');

    return (async () => {
      try {
        // load the todoList
        const fileHandle = await fs.open(this.todoFileName, 'w');

        fileHandle.writeFile(stringToWrite);

        fileHandle.close();
      } catch (e) {
        console.log(e);
        process.exit(1);
      }
    })();
  }

  newTodo(task) {
    const date = new Date();

    this.todoList.push({ isDone: false, task, date });
  }

  markTodo(todo) {
    todo.isDone = !todo.isDone;
    console.log(todo);
  }

  deleteTodo(todo) {
    const index = this.todoList.findIndex(listItem => listItem === todo);

    this.todoList.splice(index, 1); // remove the element
  }
}

const getTodoByNumber = async (reasonString, todoArray) => {
  const number = await prompt(`Number of the todo to ${reasonString}: `);
  const todo = todoArray[number]; // assuming we start todos from 0

  if (!todo) {
    await prompt('Argument out of range.');
    return;
  }

  return todo;
};

(async () => {
  const todoList = await new TodoList('todo.txt');

  while (true) {
    console.clear();
    todoList.log();

    const answer = await prompt(`${OPTIONS}\n: `);
    if (isAnyFormattedOutputMatching(format(answer), '4', '4.', 'quit', 'q')) break;

    switch (format(answer)) {
      case '1':
      case '1.':
      case 'new':
      case 'todo':
      case 'n':
        const task = await prompt('Task for the new todo: ');
        todoList.newTodo(task);
        break;

      case '2':
      case '2.':
      case 'mark':
      case 'done':
      case 'undone':
      case 'done':
      case 'x':
        const toMark = await getTodoByNumber('check/uncheck', todoList.todoList);

        if (toMark) todoList.markTodo(toMark);

        break;

      case '3':
      case '3.':
      case 'delete':
      case 'd':
        const toDelete = await getTodoByNumber('delete', todoList.todoList);

        if (toDelete) {
          const confirm = await prompt(`Delete '${toDelete.task}' ? [y/N]: `);
          if (isAnyFormattedOutputMatching(confirm, 'yes', 'y')) todoList.deleteTodo(toDelete);
        }
        break;

      default:
        await prompt('Not a valid argument!');
    }
  }

  todoList.saveFile();

  console.log('Exiting...');
  await wait(0.5);

  rl.close();
})();

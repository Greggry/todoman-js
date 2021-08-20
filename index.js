const readline = require('readline');
const fs = require('fs/promises');
const path = require('path');

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
(n)ew todo
(x) tick/untick
(d)elete
(q)uit`;

const format = string => string.toLowerCase().trim();

const isAnyFormattedOutputMatching = (valueToCompareWith, ...args) => {
  const formattedOutput = format(valueToCompareWith);

  return args.some(item => formattedOutput === format(item));
};

class TodoList {
  date;
  timezone;
  todoFileName;

  constructor(filename, date) {
    this.date = date;
    this.todoFileName = filename;

    this.timezone = date.toTimeString().substring(9, 17); // GMT+XXXX

    this.heading = `${this.date.toDateString()} - ${this.timezone}`;

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
    // an array of objects for each todo
    const todoList = [];

    // loop over the string list and add to the returned array
    fileContents
      .trim()
      .split('\n')
      .forEach((line, i) => {
        if (line === '' || i === 0) return; // the first line contains just the date

        const lastHashIndex = line.lastIndexOf('#');

        // format: '[x] some task # mm/dd/yyyy, hh:mm:mm AM/PM'
        const isDone = line[1] === 'x' ? true : false;
        const task = line.substring(4, lastHashIndex - 1);
        const date = new Date(
          `${this.date.toDateString()} ${line.substring(lastHashIndex + 2).trim()} ${this.timezone}`
        );

        try {
          if (
            line.search(/\[[ x]\]/) === -1 ||
            date.toString().toLowerCase() === 'invalid date' ||
            lastHashIndex === -1
          )
            throw new Error(`Import Error in line ${i + 1}: '${line}' cannot be imported`);
        } catch (e) {
          console.log(e.message);
          process.exit(1);
        }

        todoList.push({ isDone, task, date });
      });

    this.todoList = todoList;
  }

  log() {
    if (this.todoList.length === 0) {
      console.log('no todo items');
      return;
    }
    console.log(`${this.heading}`);

    this.todoList.forEach((todo, i) => {
      console.log(`${i + 1}: [${todo.isDone ? 'x' : ' '}] ${todo.task}`);
    });
  }

  saveFile() {
    // save the current todos as a readable string
    const todoString = this.todoList.reduce((acc, todo) => {
      return (
        acc + `[${todo.isDone ? 'x' : ' '}] ${todo.task} # ${todo.date.toTimeString().substring(0, 9)}\n`
      );
    }, `${this.heading}\n`);

    return (async () => {
      try {
        // load the todoList
        const fileHandle = await fs.open(this.todoFileName, 'w');

        fileHandle.writeFile(todoString);

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
  }

  deleteTodo(todo) {
    const index = this.todoList.findIndex(listItem => listItem === todo);

    this.todoList.splice(index, 1); // remove the element
  }
}

const getTodoByNumber = async (reasonString, todoArray) => {
  const number = await prompt(`Number of the todo to ${reasonString}: `);
  const todo = todoArray[number - 1]; // the user sees 1-indexed list

  if (!todo) {
    await prompt('Argument out of range.');
    return;
  }

  return todo;
};

const handleDirCheck = async dirName => {
  try {
    await fs.access(dirName);
  } catch (e) {
    if (e.code === 'ENOENT') fs.mkdir(path.join(__dirname, dirName));
  }
};

padDates = num => num.toString().padStart(2, '0');

const currentDate = new Date();

// store files in __dirname/DIRNAME/FILENAME
const DIRNAME = 'todos';
const FILENAME = (() => {
  const month = padDates(currentDate.getMonth() + 1); // zero based
  const dayOfMonth = padDates(currentDate.getDate());

  return (formattedDate = `${currentDate.getFullYear()}-${month}-${dayOfMonth}.txt`);
})();

(async () => {
  await handleDirCheck(DIRNAME); // create the todos directory if not present

  const todoList = await new TodoList(path.join(__dirname, DIRNAME, FILENAME), currentDate);

  while (true) {
    console.clear();
    todoList.log();

    const answer = await prompt(`${OPTIONS}\n: `);
    if (isAnyFormattedOutputMatching(format(answer), '4', '4.', 'quit', 'q')) break;

    switch (format(answer)) {
      case 'n':
        const task = await prompt('Task for the new todo: ');
        todoList.newTodo(task);
        break;

      case 'x':
        const toMark = await getTodoByNumber('tick/untick', todoList.todoList);

        if (toMark) todoList.markTodo(toMark);

        break;

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

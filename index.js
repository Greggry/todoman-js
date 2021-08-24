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

    // when a line is detected as a parent line, an object will be pushed indicating how many objects after it are its children
    const parentsChildrenGroups = [];

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

        // validation
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

        // building the object
        const todo = { isDone, task, date }; // expanded if it belongs to or forms a list

        // it's a parent todo
        if (line[4] === '+') {
          const subtasksNum = this.getSubtasksQuantity(line.substring(4));

          parentsChildrenGroups.push({ parent: todo, subtasksNum });
        }

        todoList.push(todo);
      });

    this.todoList = todoList;
    this.linkSubtasks(parentsChildrenGroups);
  }

  linkSubtasks(parentsChildrenGroups) {
    parentsChildrenGroups.forEach(group => {
      const parentIndex = this.todoList.findIndex(item => group.parent === item);
      const parent = this.todoList[parentIndex];

      parent.children = [];

      [...Array(group.subtasksNum).keys()].forEach(key => {
        const child = this.todoList[parentIndex + key + 1];

        parent.children.push(child);
        child.isSubtask = true;
      });
    });
  }

  log() {
    console.log(`${this.heading}`);

    if (this.todoList.length === 0) {
      console.log('no todo items');
      return;
    }

    this.todoList.forEach((todo, i) => {
      const indent = todo.isSubtask ? '\t' : ' ';

      console.log(`${i + 1}:${indent}[${todo.isDone ? 'x' : ' '}] ${todo.task}`);
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
    // parent = not a subtask
    const pushParentTodo = children => {
      const parentTodo = { isDone: false, task, date, children };

      this.todoList.push(parentTodo);
    };

    const date = new Date();

    // todo category logic (for when the string is '+ 10 example todo')
    if (task[0] === '+') {
      const subtaskNum = this.getSubtasksQuantity(task);

      console.log(subtaskNum);

      const subtaskArray = [];
      pushParentTodo(subtaskArray);

      // push subtasks
      [...Array(subtaskNum).keys()].forEach(key => {
        const subtask = {
          isDone: false,
          task: `${key + 1}/${subtaskNum} ${task}`,
          date,
          isSubtask: true,
        };

        subtaskArray.push(subtask);
        this.todoList.push(subtask);
      });

      return;
    }

    pushParentTodo();
  }

  getSubtasksQuantity(parent) {
    return +parent.replace(/(^[\+]\s*)(\d+)(.+$)/g, '$2'); // group and get the numbers after the +, coerce to a number
  }

  markTodo(todo) {
    if (todo.children) return;

    todo.isDone = !todo.isDone;

    if (todo.isSubtask) {
      // subtract indexes and find the closest non-negative, which is the parent
      const todoIndex = this.todoList.findIndex(item => item === todo);

      const parent = this.todoList.reduce((acc, item, i) => {
        if (!item.hasOwnProperty('children')) return acc; // ignore non-parent elements
        if (todoIndex - i < 0) return acc; // ignore elements further in the array

        // because we're looping from left to right the last parent is the correct one
        return item;
      });

      const isEachChildDone = parent.children.every(child => {
        return child.isDone === true;
      });

      parent.isDone = isEachChildDone;
    }
  }

  deleteTodo(todo) {
    if (todo.isSubtask) return;
    const index = this.todoList.findIndex(listItem => listItem === todo);

    // it's a parent - remove subtasks
    todo.children?.forEach(child => this.todoList.splice(this.todoList.indexOf(child), 1));

    this.todoList.splice(index, 1); // remove the element
  }
}

const getTodoByNumber = async (reasonString, todoArray) => {
  const number = await prompt(`Number of the todo to ${reasonString}: `);
  const todo = todoArray[number - 1]; // the user sees a 1-indexed list

  if (!todo) {
    await prompt('Argument out of range.');
    return;
  }

  return todo;
};

const handleDirCheck = async dirName => {
  try {
    await fs.access(path.join(__dirname, dirName));
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
    // console.clear(); DEBUG
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

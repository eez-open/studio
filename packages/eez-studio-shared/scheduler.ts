export enum Priority {
    Highest,
    High,
    Middle,
    Low,
    Lowest
}

interface ITask {
    name: string;
    callback: () => void;
}

const highestPriorityTasks: ITask[] = [];
const highPriorityTasks: ITask[] = [];
const middlePriorityTasks: ITask[] = [];
const lowPriorityTasks: ITask[] = [];
const lowestPriorityTasks: ITask[] = [];

export function scheduleTask(
    name: string,
    priority: Priority,
    callback: () => Promise<any>
) {
    const task = { name, callback };

    if (priority === Priority.Highest) {
        highestPriorityTasks.push(task);
    } else if (priority === Priority.High) {
        highPriorityTasks.push(task);
    } else if (priority === Priority.Middle) {
        middlePriorityTasks.push(task);
    } else if (priority === Priority.Low) {
        lowPriorityTasks.push(task);
    } else {
        lowestPriorityTasks.push(task);
    }

    if (!timeout) {
        timeout = setTimeout(run);
    }
}

let timeout: any = undefined;

async function run() {
    timeout = undefined;

    let task = highestPriorityTasks.shift();
    if (!task) {
        task = highPriorityTasks.shift();
    }
    if (!task) {
        task = middlePriorityTasks.shift();
    }
    if (!task) {
        task = lowPriorityTasks.shift();
    }
    if (!task) {
        task = lowestPriorityTasks.shift();
    }

    if (task) {
        try {
            //console.time(task.name);
            await task.callback();
            //console.timeEnd(task.name);
        } catch (err) {
            console.error("scheduled task error", task, err);
        }

        timeout = setTimeout(run);
    }
}

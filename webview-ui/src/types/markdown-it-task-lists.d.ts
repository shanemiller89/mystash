declare module 'markdown-it-task-lists' {
    import type MarkdownIt from 'markdown-it';

    interface TaskListsOptions {
        /** Enable task list rendering (default: true) */
        enabled?: boolean;
        /** Wrap checkbox in a <label> element (default: false) */
        label?: boolean;
        /** Place the label after the checkbox (default: false) */
        labelAfter?: boolean;
    }

    const taskLists: MarkdownIt.PluginWithOptions<TaskListsOptions>;
    export default taskLists;
}

#ifndef EXAMPLE_LIST_H
#define EXAMPLE_LIST_H

struct lv_ci_example {
    const char *name;
    void (*fn)(void);
};

#endif

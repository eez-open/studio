#include <lvgl/lvgl.h>

/*
Initialize LVGL library. Should be called before any other LVGL related function. 
*/
void stub_lv_init(void) {
    lv_init();
}

/*
Deinit the 'lv' library 
*/
void stub_lv_deinit(void) {
    lv_deinit();
}

/*
Returns whether the 'lv' library is currently initialized 
*/
bool stub_lv_is_initialized(void) {
    return lv_is_initialized();
}

/*
Pointer to the destination array. The function does not check for any overlapping of the source and destination memory blocks. 
*/
void * stub_lv_memcpy(void * dst, void * src, size_t len) {
    return lv_memcpy(dst,src,len);
}

void stub_lv_memset(void * dst, uint8_t v, size_t len) {
    lv_memset(dst,v,len);
}

/*
Pointer to the destination array. 
*/
void * stub_lv_memmove(void * dst, void * src, size_t len) {
    return lv_memmove(dst,src,len);
}

/*
The difference between the value of the first unmatching byte. 
*/
int stub_lv_memcmp(void * p1, void * p2, size_t len) {
    return lv_memcmp(p1,p2,len);
}

/*
Same as memset(dst, 0x00, len) . 
*/
void stub_lv_memzero(void * dst, size_t len) {
    lv_memzero(dst,len);
}

/*
The length of the string in bytes. 
*/
size_t stub_lv_strlen(char * str) {
    return lv_strlen(str);
}

/*
The length of src. The return value is equivalent to the value returned by lv_strlen(src) 
*/
size_t stub_lv_strlcpy(char * dst, char * src, size_t dst_size) {
    return lv_strlcpy(dst,src,dst_size);
}

/*
A pointer to the destination array, which is dst. dst will not be null terminated if dest_size bytes were copied from src before the end of src was reached. 
*/
char * stub_lv_strncpy(char * dst, char * src, size_t dest_size) {
    return lv_strncpy(dst,src,dest_size);
}

/*
A pointer to the destination array, which is dst. 
*/
char * stub_lv_strcpy(char * dst, char * src) {
    return lv_strcpy(dst,src);
}

/*
the difference between the value of the first unmatching character. 
*/
int stub_lv_strcmp(char * s1, char * s2) {
    return lv_strcmp(s1,s2);
}

/*
A pointer to the new allocated string. NULL if failed. 
*/
char * stub_lv_strdup(char * src) {
    return lv_strdup(src);
}

/*
A pointer to the destination string, which is dst. 
*/
char * stub_lv_strcat(char * dst, char * src) {
    return lv_strcat(dst,src);
}

/*
A pointer to the destination string, which is dst. 
*/
char * stub_lv_strncat(char * dst, char * src, size_t src_len) {
    return lv_strncat(dst,src,src_len);
}

/*
A pointer to the first occurrence of character c in the string str, or a null pointer if c is not found. 
*/
char * stub_lv_strchr(char * str, int c) {
    return lv_strchr(str,c);
}

/*
Initialize to use malloc/free/realloc etc 
*/
void stub_lv_mem_init(void) {
    lv_mem_init();
}

/*
Drop all dynamically allocated memory and reset the memory pools' state 
*/
void stub_lv_mem_deinit(void) {
    lv_mem_deinit();
}

lv_mem_pool_t stub_lv_mem_add_pool(void * mem, size_t bytes) {
    return lv_mem_add_pool(mem,bytes);
}

void stub_lv_mem_remove_pool(lv_mem_pool_t pool) {
    lv_mem_remove_pool(pool);
}

/*
Allocate memory dynamically pointer to allocated uninitialized memory, or NULL on failure 
*/
void * stub_lv_malloc(size_t size) {
    return lv_malloc(size);
}

/*
Allocate a block of zeroed memory dynamically pointer to allocated zeroed memory, or NULL on failure 
*/
void * stub_lv_calloc(size_t num, size_t size) {
    return lv_calloc(num,size);
}

/*
Allocate zeroed memory dynamically pointer to allocated zeroed memory, or NULL on failure 
*/
void * stub_lv_zalloc(size_t size) {
    return lv_zalloc(size);
}

/*
Allocate zeroed memory dynamically pointer to allocated zeroed memory, or NULL on failure 
*/
void * stub_lv_malloc_zeroed(size_t size) {
    return lv_malloc_zeroed(size);
}

/*
Free an allocated data 
*/
void stub_lv_free(void * data) {
    lv_free(data);
}

/*
Reallocate a memory with a new size. The old content will be kept. pointer to the new memory, NULL on failure 
*/
void * stub_lv_realloc(void * data_p, size_t new_size) {
    return lv_realloc(data_p,new_size);
}

/*
Used internally to execute a plain malloc operation 
*/
void * stub_lv_malloc_core(size_t size) {
    return lv_malloc_core(size);
}

/*
Used internally to execute a plain free operation 
*/
void stub_lv_free_core(void * p) {
    lv_free_core(p);
}

/*
Used internally to execute a plain realloc operation 
*/
void * stub_lv_realloc_core(void * p, size_t new_size) {
    return lv_realloc_core(p,new_size);
}

/*
Used internally by :ref:`lv_mem_monitor()` to gather LVGL heap state information. 
*/
void stub_lv_mem_monitor_core(lv_mem_monitor_t * mon_p) {
    lv_mem_monitor_core(mon_p);
}

lv_result_t stub_lv_mem_test_core(void) {
    return lv_mem_test_core();
}

/*
LV_RESULT_OK if the memory allocation system is working properly, or LV_RESULT_INVALID if there is an error. 
*/
lv_result_t stub_lv_mem_test(void) {
    return lv_mem_test();
}

/*
Give information about the work memory of dynamic allocation 
*/
void stub_lv_mem_monitor(lv_mem_monitor_t * mon_p) {
    lv_mem_monitor(mon_p);
}

int stub_lv_snprintf(char * buffer, size_t count, char * format, ... ...) {
    return lv_snprintf(buffer,count,format,...);
}

int stub_lv_vsnprintf(char * buffer, size_t count, char * format, va_list va) {
    return lv_vsnprintf(buffer,count,format,va);
}

/*
Register custom print/write function to call when a log is added. It can format its "File path", "Line number" and "Description" as required and send the formatted log message to a console or serial port. 
*/
void stub_lv_log_register_print_cb(lv_log_print_g_cb_t print_cb) {
    lv_log_register_print_cb(print_cb);
}

/*
Print a log message via printf if enabled with LV_LOG_PRINTF in lv_conf.h and/or a print callback if registered with lv_log_register_print_cb 
*/
void stub_lv_log(char * format, ... ...) {
    lv_log(format,...);
}

/*
Add a log 
*/
void stub_lv_log_add(lv_log_level_t level, char * file, int line, char * func, char * format, ... ...) {
    lv_log_add(level,file,line,func,format,...);
}

/*
You have to call this function periodically 
*/
void stub_lv_tick_inc(uint32_t tick_period) {
    lv_tick_inc(tick_period);
}

/*
Get the elapsed milliseconds since start up the elapsed milliseconds 
*/
uint32_t stub_lv_tick_get(void) {
    return lv_tick_get();
}

/*
Get the elapsed milliseconds since a previous time stamp the elapsed milliseconds since 'prev_tick' 
*/
uint32_t stub_lv_tick_elaps(uint32_t prev_tick) {
    return lv_tick_elaps(prev_tick);
}

/*
Delay for the given milliseconds. By default it's a blocking delay, but with :ref:`lv_delay_set_cb()` a custom delay function can be set too 
*/
void stub_lv_delay_ms(uint32_t ms) {
    lv_delay_ms(ms);
}

/*
Set the custom callback for 'lv_tick_get' 
*/
void stub_lv_tick_set_cb(lv_tick_get_cb_t cb) {
    lv_tick_set_cb(cb);
}

/*
Set a custom callback for 'lv_delay_ms' 
*/
void stub_lv_delay_set_cb(lv_delay_cb_t cb) {
    lv_delay_set_cb(cb);
}

/*
Initialize linked list 
*/
void stub_lv_ll_init(lv_ll_t * ll_p, uint32_t node_size) {
    lv_ll_init(ll_p,node_size);
}

/*
Add a new head to a linked list pointer to the new head 
*/
void * stub_lv_ll_ins_head(lv_ll_t * ll_p) {
    return lv_ll_ins_head(ll_p);
}

/*
Insert a new node in front of the n_act node pointer to the new node 
*/
void * stub_lv_ll_ins_prev(lv_ll_t * ll_p, void * n_act) {
    return lv_ll_ins_prev(ll_p,n_act);
}

/*
Add a new tail to a linked list pointer to the new tail 
*/
void * stub_lv_ll_ins_tail(lv_ll_t * ll_p) {
    return lv_ll_ins_tail(ll_p);
}

/*
Remove the node 'node_p' from 'll_p' linked list. It does not free the memory of node. 
*/
void stub_lv_ll_remove(lv_ll_t * ll_p, void * node_p) {
    lv_ll_remove(ll_p,node_p);
}

void stub_lv_ll_clear_custom(lv_ll_t * ll_p, void (* cleanup)(void *)) {
    lv_ll_clear_custom(ll_p,cleanup);
}

/*
Remove and free all elements from a linked list. The list remain valid but become empty. 
*/
void stub_lv_ll_clear(lv_ll_t * ll_p) {
    lv_ll_clear(ll_p);
}

/*
Move a node to a new linked list 
*/
void stub_lv_ll_chg_list(lv_ll_t * ll_ori_p, lv_ll_t * ll_new_p, void * node, bool head) {
    lv_ll_chg_list(ll_ori_p,ll_new_p,node,head);
}

/*
Return with head node of the linked list pointer to the head of 'll_p' 
*/
void * stub_lv_ll_get_head(lv_ll_t * ll_p) {
    return lv_ll_get_head(ll_p);
}

/*
Return with tail node of the linked list pointer to the tail of 'll_p' 
*/
void * stub_lv_ll_get_tail(lv_ll_t * ll_p) {
    return lv_ll_get_tail(ll_p);
}

/*
Return with the pointer of the next node after 'n_act' pointer to the next node 
*/
void * stub_lv_ll_get_next(lv_ll_t * ll_p, void * n_act) {
    return lv_ll_get_next(ll_p,n_act);
}

/*
Return with the pointer of the previous node after 'n_act' pointer to the previous node 
*/
void * stub_lv_ll_get_prev(lv_ll_t * ll_p, void * n_act) {
    return lv_ll_get_prev(ll_p,n_act);
}

/*
Return the length of the linked list. length of the linked list 
*/
uint32_t stub_lv_ll_get_len(lv_ll_t * ll_p) {
    return lv_ll_get_len(ll_p);
}

/*
Move a node before another node in the same linked list 
*/
void stub_lv_ll_move_before(lv_ll_t * ll_p, void * n_act, void * n_after) {
    lv_ll_move_before(ll_p,n_act,n_after);
}

/*
Check if a linked list is empty true: the linked list is empty; false: not empty 
*/
bool stub_lv_ll_is_empty(lv_ll_t * ll_p) {
    return lv_ll_is_empty(ll_p);
}

uint32_t stub_lv_timer_handler(void) {
    return lv_timer_handler();
}

/*
Call it in the super-loop of main() or threads. It will run lv_timer_handler() with a given period in ms. You can use it with sleep or delay in OS environment. This function is used to simplify the porting. the time after which it must be called again 
*/
uint32_t stub_lv_timer_handler_run_in_period(uint32_t period) {
    return lv_timer_handler_run_in_period(period);
}

/*
Call it in the super-loop of main() or threads. It will automatically call lv_timer_handler() at the right time. This function is used to simplify the porting. 
*/
void stub_lv_timer_periodic_handler(void) {
    lv_timer_periodic_handler();
}

/*
Set the resume callback to the timer handler 
*/
void stub_lv_timer_handler_set_resume_cb(lv_timer_handler_resume_cb_t cb, void * data) {
    lv_timer_handler_set_resume_cb(cb,data);
}

/*
Create an "empty" timer. It needs to be initialized with at least lv_timer_set_cb and lv_timer_set_period  pointer to the created timer 
*/
lv_timer_t * stub_lv_timer_create_basic(void) {
    return lv_timer_create_basic();
}

/*
Create a new lv_timer pointer to the new timer 
*/
lv_timer_t * stub_lv_timer_create(lv_timer_cb_t timer_xcb, uint32_t period, void * user_data) {
    return lv_timer_create(timer_xcb,period,user_data);
}

/*
Delete a lv_timer 
*/
void stub_lv_timer_delete(lv_timer_t * timer) {
    lv_timer_delete(timer);
}

/*
Pause a timer. 
*/
void stub_lv_timer_pause(lv_timer_t * timer) {
    lv_timer_pause(timer);
}

/*
Resume a timer. 
*/
void stub_lv_timer_resume(lv_timer_t * timer) {
    lv_timer_resume(timer);
}

/*
Set the callback to the timer (the function to call periodically) 
*/
void stub_lv_timer_set_cb(lv_timer_t * timer, lv_timer_cb_t timer_cb) {
    lv_timer_set_cb(timer,timer_cb);
}

/*
Set new period for a lv_timer 
*/
void stub_lv_timer_set_period(lv_timer_t * timer, uint32_t period) {
    lv_timer_set_period(timer,period);
}

/*
Make a lv_timer ready. It will not wait its period. 
*/
void stub_lv_timer_ready(lv_timer_t * timer) {
    lv_timer_ready(timer);
}

/*
Set the number of times a timer will repeat. 
*/
void stub_lv_timer_set_repeat_count(lv_timer_t * timer, int32_t repeat_count) {
    lv_timer_set_repeat_count(timer,repeat_count);
}

/*
Set whether a lv_timer will be deleted automatically when it is called repeat_count times. 
*/
void stub_lv_timer_set_auto_delete(lv_timer_t * timer, bool auto_delete) {
    lv_timer_set_auto_delete(timer,auto_delete);
}

/*
Set custom parameter to the lv_timer. 
*/
void stub_lv_timer_set_user_data(lv_timer_t * timer, void * user_data) {
    lv_timer_set_user_data(timer,user_data);
}

/*
Reset a lv_timer. It will be called the previously set period milliseconds later. 
*/
void stub_lv_timer_reset(lv_timer_t * timer) {
    lv_timer_reset(timer);
}

/*
Enable or disable the whole lv_timer handling 
*/
void stub_lv_timer_enable(bool en) {
    lv_timer_enable(en);
}

/*
Get idle percentage the lv_timer idle in percentage 
*/
uint32_t stub_lv_timer_get_idle(void) {
    return lv_timer_get_idle();
}

/*
Get the time remaining until the next timer will run the time remaining in ms 
*/
uint32_t stub_lv_timer_get_time_until_next(void) {
    return lv_timer_get_time_until_next();
}

/*
Iterate through the timers the next timer or NULL if there is no more timer 
*/
lv_timer_t * stub_lv_timer_get_next(lv_timer_t * timer) {
    return lv_timer_get_next(timer);
}

/*
Get the user_data passed when the timer was created pointer to the user_data 
*/
void * stub_lv_timer_get_user_data(lv_timer_t * timer) {
    return lv_timer_get_user_data(timer);
}

/*
Get the pause state of a timer true: timer is paused; false: timer is running 
*/
bool stub_lv_timer_get_paused(lv_timer_t * timer) {
    return lv_timer_get_paused(timer);
}

int32_t stub_lv_trigo_sin(int16_t angle) {
    return lv_trigo_sin(angle);
}

int32_t stub_lv_trigo_cos(int16_t angle) {
    return lv_trigo_cos(angle);
}

/*
Calculate the y value of cubic-bezier(x1, y1, x2, y2) function as specified x. the value calculated 
*/
int32_t stub_lv_cubic_bezier(int32_t x, int32_t x1, int32_t y1, int32_t x2, int32_t y2) {
    return lv_cubic_bezier(x,x1,y1,x2,y2);
}

/*
Calculate a value of a Cubic Bezier function. the value calculated from the given parameters in range of [0..LV_BEZIER_VAL_MAX] 
*/
int32_t stub_lv_bezier3(int32_t t, int32_t u0, uint32_t u1, int32_t u2, int32_t u3) {
    return lv_bezier3(t,u0,u1,u2,u3);
}

/*
Calculate the atan2 of a vector. the angle in degree calculated from the given parameters in range of [0..360] 
*/
uint16_t stub_lv_atan2(int x, int y) {
    return lv_atan2(x,y);
}

void stub_lv_sqrt(uint32_t x, lv_sqrt_res_t * q, uint32_t mask) {
    lv_sqrt(x,q,mask);
}

/*
Alternative (fast, approximate) implementation for getting the square root of an integer. 
*/
int32_t stub_lv_sqrt32(uint32_t x) {
    return lv_sqrt32(x);
}

/*
Calculate the square of an integer (input range is 0..32767). square 
*/
int32_t stub_lv_sqr(int32_t x) {
    return lv_sqr(x);
}

/*
Calculate the integer exponents. base raised to the power exponent 
*/
int64_t stub_lv_pow(int64_t base, int8_t exp) {
    return lv_pow(base,exp);
}

/*
Get the mapped of a number given an input and output range the mapped number 
*/
int32_t stub_lv_map(int32_t x, int32_t min_in, int32_t max_in, int32_t min_out, int32_t max_out) {
    return lv_map(x,min_in,max_in,min_out,max_out);
}

/*
Set the seed of the pseudo random number generator 
*/
void stub_lv_rand_set_seed(uint32_t seed) {
    lv_rand_set_seed(seed);
}

/*
Get a pseudo random number in the given range return the random number. min <= return_value <= max 
*/
uint32_t stub_lv_rand(uint32_t min, uint32_t max) {
    return lv_rand(min,max);
}

/*
Init an array. 
*/
void stub_lv_array_init(lv_array_t * array, uint32_t capacity, uint32_t element_size) {
    lv_array_init(array,capacity,element_size);
}

/*
Resize the array to the given capacity. if the new capacity is smaller than the current size, the array will be truncated. 
*/
void stub_lv_array_resize(lv_array_t * array, uint32_t new_capacity) {
    lv_array_resize(array,new_capacity);
}

/*
Deinit the array, and free the allocated memory 
*/
void stub_lv_array_deinit(lv_array_t * array) {
    lv_array_deinit(array);
}

/*
Return how many elements are stored in the array. the number of elements stored in the array 
*/
uint32_t stub_lv_array_size(lv_array_t * array) {
    return lv_array_size(array);
}

/*
Return the capacity of the array, i.e. how many elements can be stored. the capacity of the array 
*/
uint32_t stub_lv_array_capacity(lv_array_t * array) {
    return lv_array_capacity(array);
}

/*
Return if the array is empty true: array is empty; false: array is not empty 
*/
bool stub_lv_array_is_empty(lv_array_t * array) {
    return lv_array_is_empty(array);
}

/*
Return if the array is full true: array is full; false: array is not full 
*/
bool stub_lv_array_is_full(lv_array_t * array) {
    return lv_array_is_full(array);
}

/*
Copy an array to another. this will create a new array with the same capacity and size as the source array. 
*/
void stub_lv_array_copy(lv_array_t * target, lv_array_t * source) {
    lv_array_copy(target,source);
}

/*
Remove all elements in array. 
*/
void stub_lv_array_clear(lv_array_t * array) {
    lv_array_clear(array);
}

/*
Shrink the memory capacity of array if necessary. 
*/
void stub_lv_array_shrink(lv_array_t * array) {
    lv_array_shrink(array);
}

/*
Remove the element at the specified position in the array. LV_RESULT_OK: success, otherwise: error 
*/
lv_result_t stub_lv_array_remove(lv_array_t * array, uint32_t index) {
    return lv_array_remove(array,index);
}

/*
Remove from the array either a single element or a range of elements ([start, end)). This effectively reduces the container size by the number of elements removed.  When start equals to end, the function has no effect.  LV_RESULT_OK: success, otherwise: error 
*/
lv_result_t stub_lv_array_erase(lv_array_t * array, uint32_t start, uint32_t end) {
    return lv_array_erase(array,start,end);
}

/*
Concatenate two arrays. Adds new elements to the end of the array. The destination array is automatically expanded as necessary.  LV_RESULT_OK: success, otherwise: error 
*/
lv_result_t stub_lv_array_concat(lv_array_t * array, lv_array_t * other) {
    return lv_array_concat(array,other);
}

/*
Push back element. Adds a new element to the end of the array. If the array capacity is not enough for the new element, the array will be resized automatically. If the element is NULL, it will be added as an empty element.  LV_RESULT_OK: success, otherwise: error 
*/
lv_result_t stub_lv_array_push_back(lv_array_t * array, void * element) {
    return lv_array_push_back(array,element);
}

/*
Assigns one content to the array, replacing its current content. true: success; false: error 
*/
lv_result_t stub_lv_array_assign(lv_array_t * array, uint32_t index, void * value) {
    return lv_array_assign(array,index,value);
}

/*
Returns a pointer to the element at position n in the array. a pointer to the requested element, NULL if index is out of range 
*/
void * stub_lv_array_at(lv_array_t * array, uint32_t index) {
    return lv_array_at(array,index);
}

/*
Returns a pointer to the first element in the array. a pointer to the first element in the array 
*/
void * stub_lv_array_front(lv_array_t * array) {
    return lv_array_front(array);
}

/*
Returns a pointer to the last element in the array. 
*/
void * stub_lv_array_back(lv_array_t * array) {
    return lv_array_back(array);
}

/*
Call an asynchronous function the next time lv_timer_handler() is run. This function is likely to return before the call actually happens! 
*/
lv_result_t stub_lv_async_call(lv_async_cb_t async_xcb, void * user_data) {
    return lv_async_call(async_xcb,user_data);
}

/*
Cancel an asynchronous function call 
*/
lv_result_t stub_lv_async_call_cancel(lv_async_cb_t async_xcb, void * user_data) {
    return lv_async_call_cancel(async_xcb,user_data);
}

/*
Initialize an animation variable. E.g.: lv_anim_t a; lv_anim_init(&a); lv_anim_set_...(&a); lv_anim_start(&a); 
*/
void stub_lv_anim_init(lv_anim_t * a) {
    lv_anim_init(a);
}

/*
Set a variable to animate 
*/
void stub_lv_anim_set_var(lv_anim_t * a, void * var) {
    lv_anim_set_var(a,var);
}

/*
Set a function to animate var 
*/
void stub_lv_anim_set_exec_cb(lv_anim_t * a, lv_anim_exec_xcb_t exec_cb) {
    lv_anim_set_exec_cb(a,exec_cb);
}

/*
Set the duration of an animation 
*/
void stub_lv_anim_set_duration(lv_anim_t * a, uint32_t duration) {
    lv_anim_set_duration(a,duration);
}

/*
Legacy lv_anim_set_time API will be removed soon, use lv_anim_set_duration instead. 
*/
void stub_lv_anim_set_time(lv_anim_t * a, uint32_t duration) {
    lv_anim_set_time(a,duration);
}

/*
Set a delay before starting the animation 
*/
void stub_lv_anim_set_delay(lv_anim_t * a, uint32_t delay) {
    lv_anim_set_delay(a,delay);
}

/*
Set the start and end values of an animation 
*/
void stub_lv_anim_set_values(lv_anim_t * a, int32_t start, int32_t end) {
    lv_anim_set_values(a,start,end);
}

/*
Similar to lv_anim_set_exec_cb but lv_anim_custom_exec_cb_t receives lv_anim_t * as its first parameter instead of void * . This function might be used when LVGL is bound to other languages because it's more consistent to have lv_anim_t * as first parameter. 
*/
void stub_lv_anim_set_custom_exec_cb(lv_anim_t * a, lv_anim_custom_exec_cb_t exec_cb) {
    lv_anim_set_custom_exec_cb(a,exec_cb);
}

/*
Set the path (curve) of the animation. 
*/
void stub_lv_anim_set_path_cb(lv_anim_t * a, lv_anim_path_cb_t path_cb) {
    lv_anim_set_path_cb(a,path_cb);
}

/*
Set a function call when the animation really starts (considering delay ) 
*/
void stub_lv_anim_set_start_cb(lv_anim_t * a, lv_anim_start_cb_t start_cb) {
    lv_anim_set_start_cb(a,start_cb);
}

/*
Set a function to use the current value of the variable and make start and end value relative to the returned current value. 
*/
void stub_lv_anim_set_get_value_cb(lv_anim_t * a, lv_anim_get_value_cb_t get_value_cb) {
    lv_anim_set_get_value_cb(a,get_value_cb);
}

/*
Set a function call when the animation is completed 
*/
void stub_lv_anim_set_completed_cb(lv_anim_t * a, lv_anim_completed_cb_t completed_cb) {
    lv_anim_set_completed_cb(a,completed_cb);
}

/*
Set a function call when the animation is deleted. 
*/
void stub_lv_anim_set_deleted_cb(lv_anim_t * a, lv_anim_deleted_cb_t deleted_cb) {
    lv_anim_set_deleted_cb(a,deleted_cb);
}

/*
Make the animation to play back to when the forward direction is ready 
*/
void stub_lv_anim_set_playback_duration(lv_anim_t * a, uint32_t duration) {
    lv_anim_set_playback_duration(a,duration);
}

/*
Legacy lv_anim_set_playback_time API will be removed soon, use lv_anim_set_playback_duration instead. 
*/
void stub_lv_anim_set_playback_time(lv_anim_t * a, uint32_t duration) {
    lv_anim_set_playback_time(a,duration);
}

/*
Make the animation to play back to when the forward direction is ready 
*/
void stub_lv_anim_set_playback_delay(lv_anim_t * a, uint32_t delay) {
    lv_anim_set_playback_delay(a,delay);
}

/*
Make the animation repeat itself. 
*/
void stub_lv_anim_set_repeat_count(lv_anim_t * a, uint32_t cnt) {
    lv_anim_set_repeat_count(a,cnt);
}

/*
Set a delay before repeating the animation. 
*/
void stub_lv_anim_set_repeat_delay(lv_anim_t * a, uint32_t delay) {
    lv_anim_set_repeat_delay(a,delay);
}

/*
Set a whether the animation's should be applied immediately or only when the delay expired. 
*/
void stub_lv_anim_set_early_apply(lv_anim_t * a, bool en) {
    lv_anim_set_early_apply(a,en);
}

/*
Set the custom user data field of the animation. 
*/
void stub_lv_anim_set_user_data(lv_anim_t * a, void * user_data) {
    lv_anim_set_user_data(a,user_data);
}

/*
Set parameter for cubic bezier path 
*/
void stub_lv_anim_set_bezier3_param(lv_anim_t * a, int16_t x1, int16_t y1, int16_t x2, int16_t y2) {
    lv_anim_set_bezier3_param(a,x1,y1,x2,y2);
}

/*
Create an animation pointer to the created animation (different from the a parameter) 
*/
lv_anim_t * stub_lv_anim_start(lv_anim_t * a) {
    return lv_anim_start(a);
}

/*
Get a delay before starting the animation delay before the animation in milliseconds 
*/
uint32_t stub_lv_anim_get_delay(lv_anim_t * a) {
    return lv_anim_get_delay(a);
}

/*
Get the time used to play the animation. the play time in milliseconds. 
*/
uint32_t stub_lv_anim_get_playtime(lv_anim_t * a) {
    return lv_anim_get_playtime(a);
}

/*
Get the duration of an animation the duration of the animation in milliseconds 
*/
uint32_t stub_lv_anim_get_time(lv_anim_t * a) {
    return lv_anim_get_time(a);
}

/*
Get the repeat count of the animation. the repeat count or LV_ANIM_REPEAT_INFINITE for infinite repetition. 0: disabled repetition. 
*/
uint32_t stub_lv_anim_get_repeat_count(lv_anim_t * a) {
    return lv_anim_get_repeat_count(a);
}

/*
Get the user_data field of the animation the pointer to the custom user_data of the animation 
*/
void * stub_lv_anim_get_user_data(lv_anim_t * a) {
    return lv_anim_get_user_data(a);
}

/*
Delete animation(s) of a variable with a given animator function true: at least 1 animation is deleted, false: no animation is deleted 
*/
bool stub_lv_anim_delete(void * var, lv_anim_exec_xcb_t exec_cb) {
    return lv_anim_delete(var,exec_cb);
}

/*
Delete all the animations 
*/
void stub_lv_anim_delete_all(void) {
    lv_anim_delete_all();
}

/*
Get the animation of a variable and its exec_cb . pointer to the animation. 
*/
lv_anim_t * stub_lv_anim_get(void * var, lv_anim_exec_xcb_t exec_cb) {
    return lv_anim_get(var,exec_cb);
}

/*
Get global animation refresher timer. pointer to the animation refresher timer. 
*/
lv_timer_t * stub_lv_anim_get_timer(void) {
    return lv_anim_get_timer();
}

/*
Delete an animation by getting the animated variable from a . Only animations with exec_cb will be deleted. This function exists because it's logical that all anim. functions receives an lv_anim_t as their first parameter. It's not practical in C but might make the API more consequent and makes easier to generate bindings. true: at least 1 animation is deleted, false: no animation is deleted 
*/
bool stub_lv_anim_custom_delete(lv_anim_t * a, lv_anim_custom_exec_cb_t exec_cb) {
    return lv_anim_custom_delete(a,exec_cb);
}

/*
Get the animation of a variable and its exec_cb . This function exists because it's logical that all anim. functions receives an lv_anim_t as their first parameter. It's not practical in C but might make the API more consequent and makes easier to generate bindings. pointer to the animation. 
*/
lv_anim_t * stub_lv_anim_custom_get(lv_anim_t * a, lv_anim_custom_exec_cb_t exec_cb) {
    return lv_anim_custom_get(a,exec_cb);
}

/*
Get the number of currently running animations the number of running animations 
*/
uint16_t stub_lv_anim_count_running(void) {
    return lv_anim_count_running();
}

/*
Store the speed as a special value which can be used as time in animations. It will be converted to time internally based on the start and end values a special value which can be used as an animation time 
*/
uint32_t stub_lv_anim_speed(uint32_t speed) {
    return lv_anim_speed(speed);
}

/*
Store the speed as a special value which can be used as time in animations. It will be converted to time internally based on the start and end values a special value in where all three values are stored and can be used as an animation time  internally speed is stored as 10 unit/sec  internally min/max_time are stored with 10 ms unit 
*/
uint32_t stub_lv_anim_speed_clamped(uint32_t speed, uint32_t min_time, uint32_t max_time) {
    return lv_anim_speed_clamped(speed,min_time,max_time);
}

/*
Calculate the time of an animation based on its speed, start and end values. the time of the animation in milliseconds 
*/
uint32_t stub_lv_anim_speed_to_time(uint32_t speed, int32_t start, int32_t end) {
    return lv_anim_speed_to_time(speed,start,end);
}

/*
Manually refresh the state of the animations. Useful to make the animations running in a blocking process where lv_timer_handler can't run for a while. Shouldn't be used directly because it is called in :ref:`lv_refr_now()` . 
*/
void stub_lv_anim_refr_now(void) {
    lv_anim_refr_now();
}

/*
Calculate the current value of an animation applying linear characteristic the current value to set 
*/
int32_t stub_lv_anim_path_linear(lv_anim_t * a) {
    return lv_anim_path_linear(a);
}

/*
Calculate the current value of an animation slowing down the start phase the current value to set 
*/
int32_t stub_lv_anim_path_ease_in(lv_anim_t * a) {
    return lv_anim_path_ease_in(a);
}

/*
Calculate the current value of an animation slowing down the end phase the current value to set 
*/
int32_t stub_lv_anim_path_ease_out(lv_anim_t * a) {
    return lv_anim_path_ease_out(a);
}

/*
Calculate the current value of an animation applying an "S" characteristic (cosine) the current value to set 
*/
int32_t stub_lv_anim_path_ease_in_out(lv_anim_t * a) {
    return lv_anim_path_ease_in_out(a);
}

/*
Calculate the current value of an animation with overshoot at the end the current value to set 
*/
int32_t stub_lv_anim_path_overshoot(lv_anim_t * a) {
    return lv_anim_path_overshoot(a);
}

/*
Calculate the current value of an animation with 3 bounces the current value to set 
*/
int32_t stub_lv_anim_path_bounce(lv_anim_t * a) {
    return lv_anim_path_bounce(a);
}

/*
Calculate the current value of an animation applying step characteristic. (Set end value on the end of the animation) the current value to set 
*/
int32_t stub_lv_anim_path_step(lv_anim_t * a) {
    return lv_anim_path_step(a);
}

/*
A custom cubic bezier animation path, need to specify cubic-parameters in a->parameter.bezier3 the current value to set 
*/
int32_t stub_lv_anim_path_custom_bezier3(lv_anim_t * a) {
    return lv_anim_path_custom_bezier3(a);
}

/*
Create an animation timeline. pointer to the animation timeline. 
*/
lv_anim_timeline_t * stub_lv_anim_timeline_create(void) {
    return lv_anim_timeline_create();
}

/*
Delete animation timeline. 
*/
void stub_lv_anim_timeline_delete(lv_anim_timeline_t * at) {
    lv_anim_timeline_delete(at);
}

/*
Add animation to the animation timeline. 
*/
void stub_lv_anim_timeline_add(lv_anim_timeline_t * at, uint32_t start_time, lv_anim_t * a) {
    lv_anim_timeline_add(at,start_time,a);
}

/*
Start the animation timeline. total time spent in animation timeline. 
*/
uint32_t stub_lv_anim_timeline_start(lv_anim_timeline_t * at) {
    return lv_anim_timeline_start(at);
}

/*
Pause the animation timeline. 
*/
void stub_lv_anim_timeline_pause(lv_anim_timeline_t * at) {
    lv_anim_timeline_pause(at);
}

/*
Set the playback direction of the animation timeline. 
*/
void stub_lv_anim_timeline_set_reverse(lv_anim_timeline_t * at, bool reverse) {
    lv_anim_timeline_set_reverse(at,reverse);
}

/*
Make the animation timeline repeat itself. 
*/
void stub_lv_anim_timeline_set_repeat_count(lv_anim_timeline_t * at, uint32_t cnt) {
    lv_anim_timeline_set_repeat_count(at,cnt);
}

/*
Set a delay before repeating the animation timeline. 
*/
void stub_lv_anim_timeline_set_repeat_delay(lv_anim_timeline_t * at, uint32_t delay) {
    lv_anim_timeline_set_repeat_delay(at,delay);
}

/*
Set the progress of the animation timeline. 
*/
void stub_lv_anim_timeline_set_progress(lv_anim_timeline_t * at, uint16_t progress) {
    lv_anim_timeline_set_progress(at,progress);
}

/*
Get the time used to play the animation timeline. total time spent in animation timeline. 
*/
uint32_t stub_lv_anim_timeline_get_playtime(lv_anim_timeline_t * at) {
    return lv_anim_timeline_get_playtime(at);
}

/*
Get whether the animation timeline is played in reverse. return true if it is reverse playback. 
*/
bool stub_lv_anim_timeline_get_reverse(lv_anim_timeline_t * at) {
    return lv_anim_timeline_get_reverse(at);
}

/*
Get the progress of the animation timeline. return value 0~65535 to map 0~100% animation progress. 
*/
uint16_t stub_lv_anim_timeline_get_progress(lv_anim_timeline_t * at) {
    return lv_anim_timeline_get_progress(at);
}

/*
Get repeat count of the animation timeline. 
*/
uint32_t stub_lv_anim_timeline_get_repeat_count(lv_anim_timeline_t * at) {
    return lv_anim_timeline_get_repeat_count(at);
}

/*
Get repeat delay of the animation timeline. 
*/
uint32_t stub_lv_anim_timeline_get_repeat_delay(lv_anim_timeline_t * at) {
    return lv_anim_timeline_get_repeat_delay(at);
}

bool stub_lv_rb_init(lv_rb_t * tree, lv_rb_compare_t compare, size_t node_size) {
    return lv_rb_init(tree,compare,node_size);
}

lv_rb_node_t * stub_lv_rb_insert(lv_rb_t * tree, void * key) {
    return lv_rb_insert(tree,key);
}

lv_rb_node_t * stub_lv_rb_find(lv_rb_t * tree, void * key) {
    return lv_rb_find(tree,key);
}

void * stub_lv_rb_remove_node(lv_rb_t * tree, lv_rb_node_t * node) {
    return lv_rb_remove_node(tree,node);
}

void * stub_lv_rb_remove(lv_rb_t * tree, void * key) {
    return lv_rb_remove(tree,key);
}

bool stub_lv_rb_drop_node(lv_rb_t * tree, lv_rb_node_t * node) {
    return lv_rb_drop_node(tree,node);
}

bool stub_lv_rb_drop(lv_rb_t * tree, void * key) {
    return lv_rb_drop(tree,key);
}

lv_rb_node_t * stub_lv_rb_minimum(lv_rb_t * node) {
    return lv_rb_minimum(node);
}

lv_rb_node_t * stub_lv_rb_maximum(lv_rb_t * node) {
    return lv_rb_maximum(node);
}

lv_rb_node_t * stub_lv_rb_minimum_from(lv_rb_node_t * node) {
    return lv_rb_minimum_from(node);
}

lv_rb_node_t * stub_lv_rb_maximum_from(lv_rb_node_t * node) {
    return lv_rb_maximum_from(node);
}

void stub_lv_rb_destroy(lv_rb_t * tree) {
    lv_rb_destroy(tree);
}

/*
Initialize an area 
*/
void stub_lv_area_set(lv_area_t * area_p, int32_t x1, int32_t y1, int32_t x2, int32_t y2) {
    lv_area_set(area_p,x1,y1,x2,y2);
}

/*
Copy an area 
*/
void stub_lv_area_copy(lv_area_t * dest, lv_area_t * src) {
    lv_area_copy(dest,src);
}

/*
Get the width of an area the width of the area (if x1 == x2 -> width = 1) 
*/
int32_t stub_lv_area_get_width(lv_area_t * area_p) {
    return lv_area_get_width(area_p);
}

/*
Get the height of an area the height of the area (if y1 == y2 -> height = 1) 
*/
int32_t stub_lv_area_get_height(lv_area_t * area_p) {
    return lv_area_get_height(area_p);
}

/*
Set the width of an area 
*/
void stub_lv_area_set_width(lv_area_t * area_p, int32_t w) {
    lv_area_set_width(area_p,w);
}

/*
Set the height of an area 
*/
void stub_lv_area_set_height(lv_area_t * area_p, int32_t h) {
    lv_area_set_height(area_p,h);
}

/*
Return with area of an area (x * y) size of area 
*/
uint32_t stub_lv_area_get_size(lv_area_t * area_p) {
    return lv_area_get_size(area_p);
}

void stub_lv_area_increase(lv_area_t * area, int32_t w_extra, int32_t h_extra) {
    lv_area_increase(area,w_extra,h_extra);
}

void stub_lv_area_move(lv_area_t * area, int32_t x_ofs, int32_t y_ofs) {
    lv_area_move(area,x_ofs,y_ofs);
}

/*
Align an area to another 
*/
void stub_lv_area_align(lv_area_t * base, lv_area_t * to_align, lv_align_t align, int32_t ofs_x, int32_t ofs_y) {
    lv_area_align(base,to_align,align,ofs_x,ofs_y);
}

/*
Transform a point 
*/
void stub_lv_point_transform(lv_point_t * point, int32_t angle, int32_t scale_x, int32_t scale_y, lv_point_t * pivot, bool zoom_first) {
    lv_point_transform(point,angle,scale_x,scale_y,pivot,zoom_first);
}

/*
Transform an array of points 
*/
void stub_lv_point_array_transform(lv_point_t * points, size_t count, int32_t angle, int32_t scale_x, int32_t scale_y, lv_point_t * pivot, bool zoom_first) {
    lv_point_array_transform(points,count,angle,scale_x,scale_y,pivot,zoom_first);
}

lv_point_t stub_lv_point_from_precise(lv_point_precise_t * p) {
    return lv_point_from_precise(p);
}

lv_point_precise_t stub_lv_point_to_precise(lv_point_t * p) {
    return lv_point_to_precise(p);
}

void stub_lv_point_set(lv_point_t * p, int32_t x, int32_t y) {
    lv_point_set(p,x,y);
}

void stub_lv_point_precise_set(lv_point_precise_t * p, lv_value_precise_t x, lv_value_precise_t y) {
    lv_point_precise_set(p,x,y);
}

void stub_lv_point_swap(lv_point_t * p1, lv_point_t * p2) {
    lv_point_swap(p1,p2);
}

void stub_lv_point_precise_swap(lv_point_precise_t * p1, lv_point_precise_t * p2) {
    lv_point_precise_swap(p1,p2);
}

/*
Convert a percentage value to int32_t . Percentage values are stored in special range a coordinate that stores the percentage 
*/
int32_t stub_lv_pct(int32_t x) {
    return lv_pct(x);
}

int32_t stub_lv_pct_to_px(int32_t v, int32_t base) {
    return lv_pct_to_px(v,base);
}

/*
Get the pixel size of a color format in bits, bpp the pixel size in bits  :ref:`LV_COLOR_FORMAT_GET_BPP` 
*/
uint8_t stub_lv_color_format_get_bpp(lv_color_format_t cf) {
    return lv_color_format_get_bpp(cf);
}

/*
Get the pixel size of a color format in bytes the pixel size in bytes  :ref:`LV_COLOR_FORMAT_GET_SIZE` 
*/
uint8_t stub_lv_color_format_get_size(lv_color_format_t cf) {
    return lv_color_format_get_size(cf);
}

/*
Check if a color format has alpha channel or not true: has alpha channel; false: doesn't have alpha channel 
*/
bool stub_lv_color_format_has_alpha(lv_color_format_t src_cf) {
    return lv_color_format_has_alpha(src_cf);
}

/*
Create an ARGB8888 color from RGB888 + alpha the ARGB8888 color 
*/
lv_color32_t stub_lv_color_to_32(lv_color_t color, lv_opa_t opa) {
    return lv_color_to_32(color,opa);
}

/*
Convert an RGB888 color to an integer c as an integer 
*/
uint32_t stub_lv_color_to_int(lv_color_t c) {
    return lv_color_to_int(c);
}

/*
Check if two RGB888 color are equal true: equal 
*/
bool stub_lv_color_eq(lv_color_t c1, lv_color_t c2) {
    return lv_color_eq(c1,c2);
}

/*
Check if two ARGB8888 color are equal true: equal 
*/
bool stub_lv_color32_eq(lv_color32_t c1, lv_color32_t c2) {
    return lv_color32_eq(c1,c2);
}

/*
Create a color from 0x000000..0xffffff input the color 
*/
lv_color_t stub_lv_color_hex(uint32_t c) {
    return lv_color_hex(c);
}

/*
Create an RGB888 color the color 
*/
lv_color_t stub_lv_color_make(uint8_t r, uint8_t g, uint8_t b) {
    return lv_color_make(r,g,b);
}

/*
Create an ARGB8888 color the color 
*/
lv_color32_t stub_lv_color32_make(uint8_t r, uint8_t g, uint8_t b, uint8_t a) {
    return lv_color32_make(r,g,b,a);
}

/*
Create a color from 0x000..0xfff input the color 
*/
lv_color_t stub_lv_color_hex3(uint32_t c) {
    return lv_color_hex3(c);
}

/*
Convert am RGB888 color to RGB565 stored in uint16_t  color as RGB565 on uin16_t 
*/
uint16_t stub_lv_color_to_u16(lv_color_t color) {
    return lv_color_to_u16(color);
}

/*
Convert am RGB888 color to XRGB8888 stored in uint32_t  color as XRGB8888 on uin32_t (the alpha channel is always set to 0xFF) 
*/
uint32_t stub_lv_color_to_u32(lv_color_t color) {
    return lv_color_to_u32(color);
}

/*
Mix two RGB565 colors mix == 0: c2 mix == 255: c1 mix == 128: 0.5 x c1 + 0.5 x c2 
*/
uint16_t stub_lv_color_16_16_mix(uint16_t c1, uint16_t c2, uint8_t mix) {
    return lv_color_16_16_mix(c1,c2,mix);
}

/*
Mix white to a color the mixed color 
*/
lv_color_t stub_lv_color_lighten(lv_color_t c, lv_opa_t lvl) {
    return lv_color_lighten(c,lvl);
}

/*
Mix black to a color the mixed color 
*/
lv_color_t stub_lv_color_darken(lv_color_t c, lv_opa_t lvl) {
    return lv_color_darken(c,lvl);
}

/*
Convert a HSV color to RGB the given RGB color in RGB (with LV_COLOR_DEPTH depth) 
*/
lv_color_t stub_lv_color_hsv_to_rgb(uint16_t h, uint8_t s, uint8_t v) {
    return lv_color_hsv_to_rgb(h,s,v);
}

/*
Convert a 32-bit RGB color to HSV the given RGB color in HSV 
*/
lv_color_hsv_t stub_lv_color_rgb_to_hsv(uint8_t r8, uint8_t g8, uint8_t b8) {
    return lv_color_rgb_to_hsv(r8,g8,b8);
}

/*
Convert a color to HSV the given color in HSV 
*/
lv_color_hsv_t stub_lv_color_to_hsv(lv_color_t color) {
    return lv_color_to_hsv(color);
}

/*
A helper for white color a white color 
*/
lv_color_t stub_lv_color_white(void) {
    return lv_color_white();
}

/*
A helper for black color a black color 
*/
lv_color_t stub_lv_color_black(void) {
    return lv_color_black();
}

void stub_lv_color_premultiply(lv_color32_t * c) {
    lv_color_premultiply(c);
}

void stub_lv_color16_premultiply(lv_color16_t * c, lv_opa_t a) {
    lv_color16_premultiply(c,a);
}

/*
Get the luminance of a color: luminance = 0.3 R + 0.59 G + 0.11 B the brightness [0..255] 
*/
uint8_t stub_lv_color_luminance(lv_color_t c) {
    return lv_color_luminance(c);
}

/*
Get the luminance of a color16: luminance = 0.3 R + 0.59 G + 0.11 B the brightness [0..255] 
*/
uint8_t stub_lv_color16_luminance(lv_color16_t c) {
    return lv_color16_luminance(c);
}

/*
Get the luminance of a color24: luminance = 0.3 R + 0.59 G + 0.11 B the brightness [0..255] 
*/
uint8_t stub_lv_color24_luminance(uint8_t * c) {
    return lv_color24_luminance(c);
}

/*
Get the luminance of a color32: luminance = 0.3 R + 0.59 G + 0.11 B the brightness [0..255] 
*/
uint8_t stub_lv_color32_luminance(lv_color32_t c) {
    return lv_color32_luminance(c);
}

lv_color_t stub_lv_palette_main(lv_palette_t p) {
    return lv_palette_main(p);
}

lv_color_t stub_lv_palette_lighten(lv_palette_t p, uint8_t lvl) {
    return lv_palette_lighten(p,lvl);
}

lv_color_t stub_lv_palette_darken(lv_palette_t p, uint8_t lvl) {
    return lv_palette_darken(p,lvl);
}

/*
Mix two colors with a given ratio. the mixed color 
*/
lv_color_t stub_lv_color_mix(lv_color_t c1, lv_color_t c2, uint8_t mix) {
    return lv_color_mix(c1,c2,mix);
}

/*
Use bg.alpha in the return value Use fg.alpha as mix ratio 
*/
lv_color32_t stub_lv_color_mix32(lv_color32_t fg, lv_color32_t bg) {
    return lv_color_mix32(fg,bg);
}

/*
Get the brightness of a color brightness in range [0..255] 
*/
uint8_t stub_lv_color_brightness(lv_color_t c) {
    return lv_color_brightness(c);
}

void stub_lv_color_filter_dsc_init(lv_color_filter_dsc_t * dsc, lv_color_filter_cb_t cb) {
    lv_color_filter_dsc_init(dsc,cb);
}

/*
Initialize the draw buffer with the default handlers. 
*/
void stub_lv_draw_buf_init_with_default_handlers(lv_draw_buf_handlers_t * handlers) {
    lv_draw_buf_init_with_default_handlers(handlers);
}

/*
Initialize the draw buffer with given handlers. 
*/
void stub_lv_draw_buf_handlers_init(lv_draw_buf_handlers_t * handlers, lv_draw_buf_malloc_cb buf_malloc_cb, lv_draw_buf_free_cb buf_free_cb, lv_draw_buf_align_cb align_pointer_cb, lv_draw_buf_cache_operation_cb invalidate_cache_cb, lv_draw_buf_cache_operation_cb flush_cache_cb, lv_draw_buf_width_to_stride_cb width_to_stride_cb) {
    lv_draw_buf_handlers_init(handlers,buf_malloc_cb,buf_free_cb,align_pointer_cb,invalidate_cache_cb,flush_cache_cb,width_to_stride_cb);
}

/*
Get the struct which holds the callbacks for draw buf management. Custom callback can be set on the returned value pointer to the struct of handlers 
*/
lv_draw_buf_handlers_t * stub_lv_draw_buf_get_handlers(void) {
    return lv_draw_buf_get_handlers();
}

/*
Align the address of a buffer. The buffer needs to be large enough for the real data after alignment the aligned buffer 
*/
void * stub_lv_draw_buf_align(void * buf, lv_color_format_t color_format) {
    return lv_draw_buf_align(buf,color_format);
}

/*
Align the address of a buffer with custom draw buffer handlers. The buffer needs to be large enough for the real data after alignment the aligned buffer 
*/
void * stub_lv_draw_buf_align_ex(lv_draw_buf_handlers_t * handlers, void * buf, lv_color_format_t color_format) {
    return lv_draw_buf_align_ex(handlers,buf,color_format);
}

/*
Invalidate the cache of the buffer 
*/
void stub_lv_draw_buf_invalidate_cache(lv_draw_buf_t * draw_buf, lv_area_t * area) {
    lv_draw_buf_invalidate_cache(draw_buf,area);
}

/*
Flush the cache of the buffer 
*/
void stub_lv_draw_buf_flush_cache(lv_draw_buf_t * draw_buf, lv_area_t * area) {
    lv_draw_buf_flush_cache(draw_buf,area);
}

/*
Calculate the stride in bytes based on a width and color format the stride in bytes 
*/
uint32_t stub_lv_draw_buf_width_to_stride(uint32_t w, lv_color_format_t color_format) {
    return lv_draw_buf_width_to_stride(w,color_format);
}

/*
Calculate the stride in bytes based on a width and color format the stride in bytes 
*/
uint32_t stub_lv_draw_buf_width_to_stride_ex(lv_draw_buf_handlers_t * handlers, uint32_t w, lv_color_format_t color_format) {
    return lv_draw_buf_width_to_stride_ex(handlers,w,color_format);
}

/*
Clear an area on the buffer 
*/
void stub_lv_draw_buf_clear(lv_draw_buf_t * draw_buf, lv_area_t * a) {
    lv_draw_buf_clear(draw_buf,a);
}

/*
Copy an area from a buffer to another dest_area and src_area should have the same width and height  dest and src should have same color format. Color converting is not supported fow now. 
*/
void stub_lv_draw_buf_copy(lv_draw_buf_t * dest, lv_area_t * dest_area, lv_draw_buf_t * src, lv_area_t * src_area) {
    lv_draw_buf_copy(dest,dest_area,src,src_area);
}

/*
Note: Eventually, lv_draw_buf_malloc/free will be kept as private. For now, we use create to distinguish with malloc. 

Create an draw buf by allocating struct for lv_draw_buf_t and allocating a buffer for it that meets specified requirements.  
*/
lv_draw_buf_t * stub_lv_draw_buf_create(uint32_t w, uint32_t h, lv_color_format_t cf, uint32_t stride) {
    return lv_draw_buf_create(w,h,cf,stride);
}

/*
Note: Eventually, lv_draw_buf_malloc/free will be kept as private. For now, we use create to distinguish with malloc. 

Create an draw buf by allocating struct for lv_draw_buf_t and allocating a buffer for it that meets specified requirements.  
*/
lv_draw_buf_t * stub_lv_draw_buf_create_ex(lv_draw_buf_handlers_t * handlers, uint32_t w, uint32_t h, lv_color_format_t cf, uint32_t stride) {
    return lv_draw_buf_create_ex(handlers,w,h,cf,stride);
}

/*
Duplicate a draw buf with same image size, stride and color format. Copy the image data too. the duplicated draw buf on success, NULL if failed 
*/
lv_draw_buf_t * stub_lv_draw_buf_dup(lv_draw_buf_t * draw_buf) {
    return lv_draw_buf_dup(draw_buf);
}

/*
Duplicate a draw buf with same image size, stride and color format. Copy the image data too. the duplicated draw buf on success, NULL if failed 
*/
lv_draw_buf_t * stub_lv_draw_buf_dup_ex(lv_draw_buf_handlers_t * handlers, lv_draw_buf_t * draw_buf) {
    return lv_draw_buf_dup_ex(handlers,draw_buf);
}

/*
Initialize a draw buf with the given buffer and parameters. Clear draw buffer flag to zero. return LV_RESULT_OK on success, LV_RESULT_INVALID otherwise 
*/
lv_result_t stub_lv_draw_buf_init(lv_draw_buf_t * draw_buf, uint32_t w, uint32_t h, lv_color_format_t cf, uint32_t stride, void * data, uint32_t data_size) {
    return lv_draw_buf_init(draw_buf,w,h,cf,stride,data,data_size);
}

/*
Keep using the existing memory, reshape the draw buffer to the given width and height. Return NULL if data_size is smaller than the required size. 
*/
lv_draw_buf_t * stub_lv_draw_buf_reshape(lv_draw_buf_t * draw_buf, lv_color_format_t cf, uint32_t w, uint32_t h, uint32_t stride) {
    return lv_draw_buf_reshape(draw_buf,cf,w,h,stride);
}

/*
Destroy a draw buf by freeing the actual buffer if it's marked as LV_IMAGE_FLAGS_ALLOCATED in header. Then free the lv_draw_buf_t struct. 
*/
void stub_lv_draw_buf_destroy(lv_draw_buf_t * draw_buf) {
    lv_draw_buf_destroy(draw_buf);
}

/*
Return pointer to the buffer at the given coordinates 
*/
void * stub_lv_draw_buf_goto_xy(lv_draw_buf_t * buf, uint32_t x, uint32_t y) {
    return lv_draw_buf_goto_xy(buf,x,y);
}

/*
Adjust the stride of a draw buf in place. LV_RESULT_OK: success or LV_RESULT_INVALID: failed 
*/
lv_result_t stub_lv_draw_buf_adjust_stride(lv_draw_buf_t * src, uint32_t stride) {
    return lv_draw_buf_adjust_stride(src,stride);
}

/*
Premultiply draw buffer color with alpha channel. If it's already premultiplied, return directly. Only color formats with alpha channel will be processed. 

LV_RESULT_OK: premultiply success  
*/
lv_result_t stub_lv_draw_buf_premultiply(lv_draw_buf_t * draw_buf) {
    return lv_draw_buf_premultiply(draw_buf);
}

bool stub_lv_draw_buf_has_flag(lv_draw_buf_t * draw_buf, lv_image_flags_t flag) {
    return lv_draw_buf_has_flag(draw_buf,flag);
}

void stub_lv_draw_buf_set_flag(lv_draw_buf_t * draw_buf, lv_image_flags_t flag) {
    lv_draw_buf_set_flag(draw_buf,flag);
}

void stub_lv_draw_buf_clear_flag(lv_draw_buf_t * draw_buf, lv_image_flags_t flag) {
    lv_draw_buf_clear_flag(draw_buf,flag);
}

/*
As of now, draw buf share same definition as :ref:`lv_image_dsc_t` . And is interchangeable with :ref:`lv_image_dsc_t` . 
*/
void stub_lv_draw_buf_from_image(lv_draw_buf_t * buf, lv_image_dsc_t * img) {
    lv_draw_buf_from_image(buf,img);
}

void stub_lv_draw_buf_to_image(lv_draw_buf_t * buf, lv_image_dsc_t * img) {
    lv_draw_buf_to_image(buf,img);
}

/*
Set the palette color of an indexed image. Valid only for LV_COLOR_FORMAT_I1/2/4/8 
*/
void stub_lv_draw_buf_set_palette(lv_draw_buf_t * draw_buf, uint8_t index, lv_color32_t color) {
    lv_draw_buf_set_palette(draw_buf,index,color);
}

/*
Deprecated Use lv_draw_buf_set_palette instead. 
*/
void stub_lv_image_buf_set_palette(lv_image_dsc_t * dsc, uint8_t id, lv_color32_t c) {
    lv_image_buf_set_palette(dsc,id,c);
}

/*
Deprecated Use lv_draw_buffer_create/destroy instead. Free the data pointer and dsc struct of an image. 
*/
void stub_lv_image_buf_free(lv_image_dsc_t * dsc) {
    lv_image_buf_free(dsc);
}

/*
Searches base[0] to base[n - 1] for an item that matches *key. 

The function cmp must return negative if it's first argument (the search key) is less that it's second (a table entry), zero if equal, and positive if greater. Items in the array must be in ascending order.  a pointer to a matching item, or NULL if none exists.   
*/
void * stub_lv_utils_bsearch(void * key, void * base, size_t n, size_t size, int (* cmp)(void * pRef, void * pElement)) {
    return lv_utils_bsearch(key,base,n,size,cmp);
}

/*
Save a draw buf to a file LV_RESULT_OK: success; LV_RESULT_INVALID: error 
*/
lv_result_t stub_lv_draw_buf_save_to_file(lv_draw_buf_t * draw_buf, char * path) {
    return lv_draw_buf_save_to_file(draw_buf,path);
}

/*
Create an iterator based on an instance, and then the next element of the iterator can be obtained through lv_iter_next, In order to obtain the next operation in a unified and abstract way. The iterator object 
*/
lv_iter_t * stub_lv_iter_create(void * instance, uint32_t elem_size, uint32_t context_size, lv_iter_next_cb next_cb) {
    return lv_iter_create(instance,elem_size,context_size,next_cb);
}

/*
Get the context of the iterator. You can use it to store some temporary variables associated with current iterator.. the iter context 
*/
void * stub_lv_iter_get_context(lv_iter_t * iter) {
    return lv_iter_get_context(iter);
}

/*
Destroy the iterator object, and release the context. Other resources allocated by the user are not released. The user needs to release it by itself. 
*/
void stub_lv_iter_destroy(lv_iter_t * iter) {
    lv_iter_destroy(iter);
}

/*
Get the next element of the iterator. LV_RESULT_OK: Get the next element successfully LV_RESULT_INVALID: The next element is invalid 
*/
lv_result_t stub_lv_iter_next(lv_iter_t * iter, void * elem) {
    return lv_iter_next(iter,elem);
}

/*
Make the iterator peekable, which means that the user can peek the next element without advancing the iterator. 
*/
void stub_lv_iter_make_peekable(lv_iter_t * iter, uint32_t capacity) {
    lv_iter_make_peekable(iter,capacity);
}

/*
Peek the next element of the iterator without advancing the iterator. LV_RESULT_OK: Peek the next element successfully LV_RESULT_INVALID: The next element is invalid 
*/
lv_result_t stub_lv_iter_peek(lv_iter_t * iter, void * elem) {
    return lv_iter_peek(iter,elem);
}

/*
Only advance the iterator without getting the next element. LV_RESULT_OK: Peek the next element successfully LV_RESULT_INVALID: The next element is invalid 
*/
lv_result_t stub_lv_iter_peek_advance(lv_iter_t * iter) {
    return lv_iter_peek_advance(iter);
}

/*
Reset the peek cursor to the next cursor. LV_RESULT_OK: Reset the peek buffer successfully LV_RESULT_INVALID: The peek buffer is invalid 
*/
lv_result_t stub_lv_iter_peek_reset(lv_iter_t * iter) {
    return lv_iter_peek_reset(iter);
}

/*
Inspect the element of the iterator. The callback function will be called for each element of the iterator. 
*/
void stub_lv_iter_inspect(lv_iter_t * iter, lv_iter_inspect_cb inspect_cb) {
    lv_iter_inspect(iter,inspect_cb);
}

/*
Create a new thread LV_RESULT_OK: success; LV_RESULT_INVALID: failure 
*/
lv_result_t stub_lv_thread_init(lv_thread_t * thread, lv_thread_prio_t prio, void (* callback)(void *), size_t stack_size, void * user_data) {
    return lv_thread_init(thread,prio,callback,stack_size,user_data);
}

/*
Delete a thread LV_RESULT_OK: success; LV_RESULT_INVALID: failure 
*/
lv_result_t stub_lv_thread_delete(lv_thread_t * thread) {
    return lv_thread_delete(thread);
}

/*
Create a mutex LV_RESULT_OK: success; LV_RESULT_INVALID: failure 
*/
lv_result_t stub_lv_mutex_init(lv_mutex_t * mutex) {
    return lv_mutex_init(mutex);
}

/*
Lock a mutex LV_RESULT_OK: success; LV_RESULT_INVALID: failure 
*/
lv_result_t stub_lv_mutex_lock(lv_mutex_t * mutex) {
    return lv_mutex_lock(mutex);
}

/*
Lock a mutex from interrupt LV_RESULT_OK: success; LV_RESULT_INVALID: failure 
*/
lv_result_t stub_lv_mutex_lock_isr(lv_mutex_t * mutex) {
    return lv_mutex_lock_isr(mutex);
}

/*
Unlock a mutex LV_RESULT_OK: success; LV_RESULT_INVALID: failure 
*/
lv_result_t stub_lv_mutex_unlock(lv_mutex_t * mutex) {
    return lv_mutex_unlock(mutex);
}

/*
Delete a mutex LV_RESULT_OK: success; LV_RESULT_INVALID: failure 
*/
lv_result_t stub_lv_mutex_delete(lv_mutex_t * mutex) {
    return lv_mutex_delete(mutex);
}

/*
Create a thread synchronization object LV_RESULT_OK: success; LV_RESULT_INVALID: failure 
*/
lv_result_t stub_lv_thread_sync_init(lv_thread_sync_t * sync) {
    return lv_thread_sync_init(sync);
}

/*
Wait for a "signal" on a sync object LV_RESULT_OK: success; LV_RESULT_INVALID: failure 
*/
lv_result_t stub_lv_thread_sync_wait(lv_thread_sync_t * sync) {
    return lv_thread_sync_wait(sync);
}

/*
Send a wake-up signal to a sync object LV_RESULT_OK: success; LV_RESULT_INVALID: failure 
*/
lv_result_t stub_lv_thread_sync_signal(lv_thread_sync_t * sync) {
    return lv_thread_sync_signal(sync);
}

/*
Send a wake-up signal to a sync object from interrupt LV_RESULT_OK: success; LV_RESULT_INVALID: failure 
*/
lv_result_t stub_lv_thread_sync_signal_isr(lv_thread_sync_t * sync) {
    return lv_thread_sync_signal_isr(sync);
}

/*
Delete a sync object LV_RESULT_OK: success; LV_RESULT_INVALID: failure 
*/
lv_result_t stub_lv_thread_sync_delete(lv_thread_sync_t * sync) {
    return lv_thread_sync_delete(sync);
}

/*
Lock LVGL's general mutex. LVGL is not thread safe, so a mutex is used to avoid executing multiple LVGL functions at the same time from different threads. It shall be called when calling LVGL functions from threads different than lv_timer_handler's thread. It doesn't need to be called in LVGL events because they are called from lv_timer_handler(). It is called internally in lv_timer_handler(). 
*/
void stub_lv_lock(void) {
    lv_lock();
}

/*
Same as :ref:`lv_lock()` but can be called from an interrupt. LV_RESULT_OK: success; LV_RESULT_INVALID: failure 
*/
lv_result_t stub_lv_lock_isr(void) {
    return lv_lock_isr();
}

/*
The pair of :ref:`lv_lock()` and :ref:`lv_lock_isr()` . It unlocks LVGL general mutex. It is called internally in lv_timer_handler(). 
*/
void stub_lv_unlock(void) {
    lv_unlock();
}

/*
Get the size of a cache entry. The size of the cache entry. 
*/
uint32_t stub_lv_cache_entry_get_size(uint32_t node_size) {
    return lv_cache_entry_get_size(node_size);
}

/*
Get the reference count of a cache entry. The reference count of the cache entry. 
*/
int32_t stub_lv_cache_entry_get_ref(lv_cache_entry_t * entry) {
    return lv_cache_entry_get_ref(entry);
}

/*
Get the node size of a cache entry. Which is the same size with :ref:`lv_cache_entry_get_size()` 's node_size parameter. The node size of the cache entry. 
*/
uint32_t stub_lv_cache_entry_get_node_size(lv_cache_entry_t * entry) {
    return lv_cache_entry_get_node_size(entry);
}

/*
Check if a cache entry is invalid. True: the cache entry is invalid. False: the cache entry is valid. 
*/
bool stub_lv_cache_entry_is_invalid(lv_cache_entry_t * entry) {
    return lv_cache_entry_is_invalid(entry);
}

/*
Get the data of a cache entry. The pointer to the data of the cache entry. 
*/
void * stub_lv_cache_entry_get_data(lv_cache_entry_t * entry) {
    return lv_cache_entry_get_data(entry);
}

/*
Get the cache instance of a cache entry. The pointer to the cache instance of the cache entry. 
*/
lv_cache_t * stub_lv_cache_entry_get_cache(lv_cache_entry_t * entry) {
    return lv_cache_entry_get_cache(entry);
}

/*
Get the cache entry of a data. The data should be allocated by the cache instance. The pointer to the cache entry of the data. 
*/
lv_cache_entry_t * stub_lv_cache_entry_get_entry(void * data, uint32_t node_size) {
    return lv_cache_entry_get_entry(data,node_size);
}

/*
Allocate a cache entry. The pointer to the allocated cache entry. 
*/
lv_cache_entry_t * stub_lv_cache_entry_alloc(uint32_t node_size, lv_cache_t * cache) {
    return lv_cache_entry_alloc(node_size,cache);
}

/*
Initialize a cache entry. 
*/
void stub_lv_cache_entry_init(lv_cache_entry_t * entry, lv_cache_t * cache, uint32_t node_size) {
    lv_cache_entry_init(entry,cache,node_size);
}

/*
Deallocate a cache entry. And the data of the cache entry will be freed. 
*/
void stub_lv_cache_entry_delete(lv_cache_entry_t * entry) {
    lv_cache_entry_delete(entry);
}

/*
Initialize image cache. LV_RESULT_OK: initialization succeeded, LV_RESULT_INVALID: failed. 
*/
lv_result_t stub_lv_image_cache_init(uint32_t size) {
    return lv_image_cache_init(size);
}

/*
Resize image cache. If set to 0, the cache will be disabled. 
*/
void stub_lv_image_cache_resize(uint32_t new_size, bool evict_now) {
    lv_image_cache_resize(new_size,evict_now);
}

/*
Invalidate image cache. Use NULL to invalidate all images. 
*/
void stub_lv_image_cache_drop(void * src) {
    lv_image_cache_drop(src);
}

/*
Return true if the image cache is enabled. true: enabled, false: disabled. 
*/
bool stub_lv_image_cache_is_enabled(void) {
    return lv_image_cache_is_enabled();
}

/*
Create an iterator to iterate over the image cache. an iterator to iterate over the image cache. 
*/
lv_iter_t * stub_lv_image_cache_iter_create(void) {
    return lv_image_cache_iter_create();
}

/*
Dump the content of the image cache in a human-readable format with cache order. 
*/
void stub_lv_image_cache_dump(void) {
    lv_image_cache_dump();
}

/*
Initialize image header cache. LV_RESULT_OK: initialization succeeded, LV_RESULT_INVALID: failed. 
*/
lv_result_t stub_lv_image_header_cache_init(uint32_t count) {
    return lv_image_header_cache_init(count);
}

/*
Resize image header cache. If set to 0, the cache is disabled. 
*/
void stub_lv_image_header_cache_resize(uint32_t count, bool evict_now) {
    lv_image_header_cache_resize(count,evict_now);
}

/*
Invalidate image header cache. Use NULL to invalidate all image headers. It's also automatically called when an image is invalidated. 
*/
void stub_lv_image_header_cache_drop(void * src) {
    lv_image_header_cache_drop(src);
}

/*
Return true if the image header cache is enabled. true: enabled, false: disabled. 
*/
bool stub_lv_image_header_cache_is_enabled(void) {
    return lv_image_header_cache_is_enabled();
}

/*
Create an iterator to iterate over the image header cache. an iterator to iterate over the image header cache. 
*/
lv_iter_t * stub_lv_image_header_cache_iter_create(void) {
    return lv_image_header_cache_iter_create();
}

/*
Dump the content of the image header cache in a human-readable format with cache order. 
*/
void stub_lv_image_header_cache_dump(void) {
    lv_image_header_cache_dump();
}

/*
Create a cache object with the given parameters. Returns a pointer to the created cache object on success, NULL on error. 
*/
lv_cache_t * stub_lv_cache_create(lv_cache_class_t * cache_class, size_t node_size, size_t max_size, lv_cache_ops_t ops) {
    return lv_cache_create(cache_class,node_size,max_size,ops);
}

/*
Destroy a cache object. 
*/
void stub_lv_cache_destroy(lv_cache_t * cache, void * user_data) {
    lv_cache_destroy(cache,user_data);
}

/*
Acquire a cache entry with the given key. If entry not in cache, it will return NULL (not found). If the entry is found, it's priority will be changed by the cache's policy. And the lv_cache_entry_t::ref_cnt will be incremented. Returns a pointer to the acquired cache entry on success with lv_cache_entry_t::ref_cnt incremented, NULL on error. 
*/
lv_cache_entry_t * stub_lv_cache_acquire(lv_cache_t * cache, void * key, void * user_data) {
    return lv_cache_acquire(cache,key,user_data);
}

/*
Acquire a cache entry with the given key. If the entry is not in the cache, it will create a new entry with the given key. If the entry is found, it's priority will be changed by the cache's policy. And the lv_cache_entry_t::ref_cnt will be incremented. If you want to use this API to simplify the code, you should provide a :ref:`lv_cache_ops_t::create_cb` that creates a new entry with the given key. This API is a combination of :ref:`lv_cache_acquire()` and :ref:`lv_cache_add()` . The effect is the same as calling :ref:`lv_cache_acquire()` and :ref:`lv_cache_add()` separately. And the internal impact on cache is also consistent with these two APIs. Returns a pointer to the acquired or created cache entry on success with lv_cache_entry_t::ref_cnt incremented, NULL on error. 
*/
lv_cache_entry_t * stub_lv_cache_acquire_or_create(lv_cache_t * cache, void * key, void * user_data) {
    return lv_cache_acquire_or_create(cache,key,user_data);
}

/*
Add a new cache entry with the given key and data. If the cache is full, the cache's policy will be used to evict an entry. Returns a pointer to the added cache entry on success with lv_cache_entry_t::ref_cnt incremented, NULL on error. 
*/
lv_cache_entry_t * stub_lv_cache_add(lv_cache_t * cache, void * key, void * user_data) {
    return lv_cache_add(cache,key,user_data);
}

/*
Release a cache entry. The lv_cache_entry_t::ref_cnt will be decremented. If the lv_cache_entry_t::ref_cnt is zero, it will issue an error. If the entry passed to this function is the last reference to the data and the entry is marked as invalid, the cache's policy will be used to evict the entry. 
*/
void stub_lv_cache_release(lv_cache_t * cache, lv_cache_entry_t * entry, void * user_data) {
    lv_cache_release(cache,entry,user_data);
}

/*
Reserve a certain amount of memory/count in the cache. This function is useful when you want to reserve a certain amount of memory/count in advance, for example, when you know that you will need it later. When the current cache size is max than the reserved size, the function will evict entries until the reserved size is reached. 
*/
void stub_lv_cache_reserve(lv_cache_t * cache, uint32_t reserved_size, void * user_data) {
    lv_cache_reserve(cache,reserved_size,user_data);
}

/*
Drop a cache entry with the given key. If the entry is not in the cache, nothing will happen to it. If the entry is found, it will be removed from the cache and its data will be freed when the last reference to it is released. The data will not be freed immediately but when the last reference to it is released. But this entry will not be found by :ref:`lv_cache_acquire()` . If you want cache a same key again, you should use :ref:`lv_cache_add()` or :ref:`lv_cache_acquire_or_create()` . 
*/
void stub_lv_cache_drop(lv_cache_t * cache, void * key, void * user_data) {
    lv_cache_drop(cache,key,user_data);
}

/*
Drop all cache entries. All entries will be removed from the cache and their data will be freed when the last reference to them is released. If some entries are still referenced by other objects, it will issue an error. And this case shouldn't happen in normal cases.. 
*/
void stub_lv_cache_drop_all(lv_cache_t * cache, void * user_data) {
    lv_cache_drop_all(cache,user_data);
}

/*
Evict one entry from the cache. The eviction policy will be used to select the entry to evict. Returns true if an entry is evicted, false if no entry is evicted. 
*/
bool stub_lv_cache_evict_one(lv_cache_t * cache, void * user_data) {
    return lv_cache_evict_one(cache,user_data);
}

/*
Set the maximum size of the cache. If the current cache size is greater than the new maximum size, the cache's policy will be used to evict entries until the new maximum size is reached. If set to 0, the cache will be disabled. But this behavior will happen only new entries are added to the cache. 
*/
void stub_lv_cache_set_max_size(lv_cache_t * cache, size_t max_size, void * user_data) {
    lv_cache_set_max_size(cache,max_size,user_data);
}

/*
Get the maximum size of the cache. Returns the maximum size of the cache. 
*/
size_t stub_lv_cache_get_max_size(lv_cache_t * cache, void * user_data) {
    return lv_cache_get_max_size(cache,user_data);
}

/*
Get the current size of the cache. Returns the current size of the cache. 
*/
size_t stub_lv_cache_get_size(lv_cache_t * cache, void * user_data) {
    return lv_cache_get_size(cache,user_data);
}

/*
Get the free size of the cache. Returns the free size of the cache. 
*/
size_t stub_lv_cache_get_free_size(lv_cache_t * cache, void * user_data) {
    return lv_cache_get_free_size(cache,user_data);
}

/*
Return true if the cache is enabled. Disabled cache means that when the max_size of the cache is 0. In this case, all cache operations will be no-op. Returns true if the cache is enabled, false otherwise. 
*/
bool stub_lv_cache_is_enabled(lv_cache_t * cache) {
    return lv_cache_is_enabled(cache);
}

/*
Set the compare callback of the cache. 
*/
void stub_lv_cache_set_compare_cb(lv_cache_t * cache, lv_cache_compare_cb_t compare_cb, void * user_data) {
    lv_cache_set_compare_cb(cache,compare_cb,user_data);
}

/*
Set the create callback of the cache. 
*/
void stub_lv_cache_set_create_cb(lv_cache_t * cache, lv_cache_create_cb_t alloc_cb, void * user_data) {
    lv_cache_set_create_cb(cache,alloc_cb,user_data);
}

/*
Set the free callback of the cache. 
*/
void stub_lv_cache_set_free_cb(lv_cache_t * cache, lv_cache_free_cb_t free_cb, void * user_data) {
    lv_cache_set_free_cb(cache,free_cb,user_data);
}

/*
Give a name for a cache object. Only the pointer of the string is saved. 
*/
void stub_lv_cache_set_name(lv_cache_t * cache, char * name) {
    lv_cache_set_name(cache,name);
}

/*
Get the name of a cache object. Returns the name of the cache. 
*/
char * stub_lv_cache_get_name(lv_cache_t * cache) {
    return lv_cache_get_name(cache);
}

/*
Create an iterator for the cache object. The iterator is used to iterate over all cache entries. Returns a pointer to the created iterator on success, NULL on error. 
*/
lv_iter_t * stub_lv_cache_iter_create(lv_cache_t * cache) {
    return lv_cache_iter_create(cache);
}

/*
Return with the bitmap of a font. You must call :ref:`lv_font_get_glyph_dsc()` to get g_dsc ( :ref:`lv_font_glyph_dsc_t` ) before you can call this function.  pointer to the glyph's data. It can be a draw buffer for bitmap fonts or an image source for imgfonts. 
*/
void * stub_lv_font_get_glyph_bitmap(lv_font_glyph_dsc_t * g_dsc, lv_draw_buf_t * draw_buf) {
    return lv_font_get_glyph_bitmap(g_dsc,draw_buf);
}

/*
Get the descriptor of a glyph true: descriptor is successfully loaded into dsc_out . false: the letter was not found, no data is loaded to dsc_out 
*/
bool stub_lv_font_get_glyph_dsc(lv_font_t * font, lv_font_glyph_dsc_t * dsc_out, uint32_t letter, uint32_t letter_next) {
    return lv_font_get_glyph_dsc(font,dsc_out,letter,letter_next);
}

/*
Release the bitmap of a font. You must call :ref:`lv_font_get_glyph_dsc()` to get g_dsc ( :ref:`lv_font_glyph_dsc_t` ) before you can call this function. 
*/
void stub_lv_font_glyph_release_draw_data(lv_font_glyph_dsc_t * g_dsc) {
    lv_font_glyph_release_draw_data(g_dsc);
}

/*
Get the width of a glyph with kerning the width of the glyph 
*/
uint16_t stub_lv_font_get_glyph_width(lv_font_t * font, uint32_t letter, uint32_t letter_next) {
    return lv_font_get_glyph_width(font,letter,letter_next);
}

/*
Get the line height of a font. All characters fit into this height the height of a font 
*/
int32_t stub_lv_font_get_line_height(lv_font_t * font) {
    return lv_font_get_line_height(font);
}

/*
Configure the use of kerning information stored in a font 
*/
void stub_lv_font_set_kerning(lv_font_t * font, lv_font_kerning_t kerning) {
    lv_font_set_kerning(font,kerning);
}

/*
Just a wrapper around LV_FONT_DEFAULT because it might be more convenient to use a function in some cases pointer to LV_FONT_DEFAULT 
*/
lv_font_t * stub_lv_font_default(void) {
    return lv_font_default();
}

/*
Get size of a text 
*/
void stub_lv_text_get_size(lv_point_t * size_res, char * text, lv_font_t * font, int32_t letter_space, int32_t line_space, int32_t max_width, lv_text_flag_t flag) {
    lv_text_get_size(size_res,text,font,letter_space,line_space,max_width,flag);
}

/*
Give the length of a text with a given font length of a char_num long text 
*/
int32_t stub_lv_text_get_width(char * txt, uint32_t length, lv_font_t * font, int32_t letter_space) {
    return lv_text_get_width(txt,length,font,letter_space);
}

/*
Get the real text alignment from the a text alignment, base direction and a text. 
*/
void stub_lv_bidi_calculate_align(lv_text_align_t * align, lv_base_dir_t * base_dir, char * txt) {
    lv_bidi_calculate_align(align,base_dir,txt);
}

/*
Set custom neutrals string 
*/
void stub_lv_bidi_set_custom_neutrals_static(char * neutrals) {
    lv_bidi_set_custom_neutrals_static(neutrals);
}

/*
Register a new layout the ID of the new layout 
*/
uint32_t stub_lv_layout_register(lv_layout_update_cb_t cb, void * user_data) {
    return lv_layout_register(cb,user_data);
}

/*
Initialize a flex layout to default values 
*/
void stub_lv_flex_init(void) {
    lv_flex_init();
}

/*
Set how the item should flow 
*/
void stub_lv_obj_set_flex_flow(lv_obj_t * obj, lv_flex_flow_t flow) {
    lv_obj_set_flex_flow(obj,flow);
}

/*
Set how to place (where to align) the items and tracks 
*/
void stub_lv_obj_set_flex_align(lv_obj_t * obj, lv_flex_align_t main_place, lv_flex_align_t cross_place, lv_flex_align_t track_cross_place) {
    lv_obj_set_flex_align(obj,main_place,cross_place,track_cross_place);
}

/*
Sets the width or height (on main axis) to grow the object in order fill the free space 
*/
void stub_lv_obj_set_flex_grow(lv_obj_t * obj, uint8_t grow) {
    lv_obj_set_flex_grow(obj,grow);
}

void stub_lv_grid_init(void) {
    lv_grid_init();
}

void stub_lv_obj_set_grid_dsc_array(lv_obj_t * obj, int32_t col_dsc[], int32_t row_dsc[]) {
    lv_obj_set_grid_dsc_array(obj,col_dsc,row_dsc);
}

void stub_lv_obj_set_grid_align(lv_obj_t * obj, lv_grid_align_t column_align, lv_grid_align_t row_align) {
    lv_obj_set_grid_align(obj,column_align,row_align);
}

/*
Set the cell of an object. The object's parent needs to have grid layout, else nothing will happen 
*/
void stub_lv_obj_set_grid_cell(lv_obj_t * obj, lv_grid_align_t column_align, int32_t col_pos, int32_t col_span, lv_grid_align_t row_align, int32_t row_pos, int32_t row_span) {
    lv_obj_set_grid_cell(obj,column_align,col_pos,col_span,row_align,row_pos,row_span);
}

/*
Just a wrapper to LV_GRID_FR for bindings. 
*/
int32_t stub_lv_grid_fr(uint8_t x) {
    return lv_grid_fr(x);
}

/*
Initialize a style Do not call lv_style_init on styles that already have some properties because this function won't free the used memory, just sets a default state for the style. In other words be sure to initialize styles only once! 
*/
void stub_lv_style_init(lv_style_t * style) {
    lv_style_init(style);
}

/*
Clear all properties from a style and free all allocated memories. 
*/
void stub_lv_style_reset(lv_style_t * style) {
    lv_style_reset(style);
}

/*
Check if a style is constant true: the style is constant 
*/
bool stub_lv_style_is_const(lv_style_t * style) {
    return lv_style_is_const(style);
}

/*
Register a new style property for custom usage a new property ID, or LV_STYLE_PROP_INV if there are no more available. Example: lv_style_prop_t MY_PROP; static inline void lv_style_set_my_prop(lv_style_t * style, lv_color_t value) {  lv_style_value_t v = {.color = value}; lv_style_set_prop(style, MY_PROP, v); }  ...  MY_PROP = lv_style_register_prop();  ...  lv_style_set_my_prop(&style1, lv_palette_main(LV_PALETTE_RED)); 
*/
lv_style_prop_t stub_lv_style_register_prop(uint8_t flag) {
    return lv_style_register_prop(flag);
}

/*
Get the number of custom properties that have been registered thus far. 
*/
lv_style_prop_t stub_lv_style_get_num_custom_props(void) {
    return lv_style_get_num_custom_props();
}

/*
Remove a property from a style true: the property was found and removed; false: the property wasn't found 
*/
bool stub_lv_style_remove_prop(lv_style_t * style, lv_style_prop_t prop) {
    return lv_style_remove_prop(style,prop);
}

/*
Set the value of property in a style. This function shouldn't be used directly by the user. Instead use lv_style_set_<prop_name>() . E.g. lv_style_set_bg_color() 
*/
void stub_lv_style_set_prop(lv_style_t * style, lv_style_prop_t prop, lv_style_value_t value) {
    lv_style_set_prop(style,prop,value);
}

/*
Get the value of a property LV_RESULT_INVALID: the property wasn't found in the style ( value is unchanged) LV_RESULT_OK: the property was fond, and value is set accordingly  For performance reasons there are no sanity check on style 
*/
lv_style_res_t stub_lv_style_get_prop(lv_style_t * style, lv_style_prop_t prop, lv_style_value_t * value) {
    return lv_style_get_prop(style,prop,value);
}

/*
Initialize a transition descriptor. const static lv_style_prop_t trans_props[] = { LV_STYLE_BG_OPA, LV_STYLE_BG_COLOR, 0 }; static lv_style_transition_dsc_t trans1;  lv_style_transition_dsc_init(&trans1, trans_props, NULL, 300, 0, NULL); 
*/
void stub_lv_style_transition_dsc_init(lv_style_transition_dsc_t * tr, lv_style_prop_t props[], lv_anim_path_cb_t path_cb, uint32_t time, uint32_t delay, void * user_data) {
    lv_style_transition_dsc_init(tr,props,path_cb,time,delay,user_data);
}

/*
Get the default value of a property the default value 
*/
lv_style_value_t stub_lv_style_prop_get_default(lv_style_prop_t prop) {
    return lv_style_prop_get_default(prop);
}

/*
Get the value of a property LV_RESULT_INVALID: the property wasn't found in the style ( value is unchanged) LV_RESULT_OK: the property was fond, and value is set accordingly  For performance reasons there are no sanity check on style  This function is the same as :ref:`lv_style_get_prop` but inlined. Use it only on performance critical places 
*/
lv_style_res_t stub_lv_style_get_prop_inlined(lv_style_t * style, lv_style_prop_t prop, lv_style_value_t * value) {
    return lv_style_get_prop_inlined(style,prop,value);
}

/*
Checks if a style is empty (has no properties) true if the style is empty 
*/
bool stub_lv_style_is_empty(lv_style_t * style) {
    return lv_style_is_empty(style);
}

/*
Tell the group of a property. If the a property from a group is set in a style the (1 << group) bit of style->has_group is set. It allows early skipping the style if the property is not exists in the style at all. the group [0..30] 30 means all the custom properties with index > 120 
*/
uint32_t stub_lv_style_get_prop_group(lv_style_prop_t prop) {
    return lv_style_get_prop_group(prop);
}

/*
Get the flags of a built-in or custom property. 

the flags of the property  
*/
uint8_t stub_lv_style_prop_lookup_flags(lv_style_prop_t prop) {
    return lv_style_prop_lookup_flags(prop);
}

void stub_lv_style_set_width(lv_style_t * style, int32_t value) {
    lv_style_set_width(style,value);
}

void stub_lv_style_set_min_width(lv_style_t * style, int32_t value) {
    lv_style_set_min_width(style,value);
}

void stub_lv_style_set_max_width(lv_style_t * style, int32_t value) {
    lv_style_set_max_width(style,value);
}

void stub_lv_style_set_height(lv_style_t * style, int32_t value) {
    lv_style_set_height(style,value);
}

void stub_lv_style_set_min_height(lv_style_t * style, int32_t value) {
    lv_style_set_min_height(style,value);
}

void stub_lv_style_set_max_height(lv_style_t * style, int32_t value) {
    lv_style_set_max_height(style,value);
}

void stub_lv_style_set_length(lv_style_t * style, int32_t value) {
    lv_style_set_length(style,value);
}

void stub_lv_style_set_x(lv_style_t * style, int32_t value) {
    lv_style_set_x(style,value);
}

void stub_lv_style_set_y(lv_style_t * style, int32_t value) {
    lv_style_set_y(style,value);
}

void stub_lv_style_set_align(lv_style_t * style, lv_align_t value) {
    lv_style_set_align(style,value);
}

void stub_lv_style_set_transform_width(lv_style_t * style, int32_t value) {
    lv_style_set_transform_width(style,value);
}

void stub_lv_style_set_transform_height(lv_style_t * style, int32_t value) {
    lv_style_set_transform_height(style,value);
}

void stub_lv_style_set_translate_x(lv_style_t * style, int32_t value) {
    lv_style_set_translate_x(style,value);
}

void stub_lv_style_set_translate_y(lv_style_t * style, int32_t value) {
    lv_style_set_translate_y(style,value);
}

void stub_lv_style_set_transform_scale_x(lv_style_t * style, int32_t value) {
    lv_style_set_transform_scale_x(style,value);
}

void stub_lv_style_set_transform_scale_y(lv_style_t * style, int32_t value) {
    lv_style_set_transform_scale_y(style,value);
}

void stub_lv_style_set_transform_rotation(lv_style_t * style, int32_t value) {
    lv_style_set_transform_rotation(style,value);
}

void stub_lv_style_set_transform_pivot_x(lv_style_t * style, int32_t value) {
    lv_style_set_transform_pivot_x(style,value);
}

void stub_lv_style_set_transform_pivot_y(lv_style_t * style, int32_t value) {
    lv_style_set_transform_pivot_y(style,value);
}

void stub_lv_style_set_transform_skew_x(lv_style_t * style, int32_t value) {
    lv_style_set_transform_skew_x(style,value);
}

void stub_lv_style_set_transform_skew_y(lv_style_t * style, int32_t value) {
    lv_style_set_transform_skew_y(style,value);
}

void stub_lv_style_set_pad_top(lv_style_t * style, int32_t value) {
    lv_style_set_pad_top(style,value);
}

void stub_lv_style_set_pad_bottom(lv_style_t * style, int32_t value) {
    lv_style_set_pad_bottom(style,value);
}

void stub_lv_style_set_pad_left(lv_style_t * style, int32_t value) {
    lv_style_set_pad_left(style,value);
}

void stub_lv_style_set_pad_right(lv_style_t * style, int32_t value) {
    lv_style_set_pad_right(style,value);
}

void stub_lv_style_set_pad_row(lv_style_t * style, int32_t value) {
    lv_style_set_pad_row(style,value);
}

void stub_lv_style_set_pad_column(lv_style_t * style, int32_t value) {
    lv_style_set_pad_column(style,value);
}

void stub_lv_style_set_margin_top(lv_style_t * style, int32_t value) {
    lv_style_set_margin_top(style,value);
}

void stub_lv_style_set_margin_bottom(lv_style_t * style, int32_t value) {
    lv_style_set_margin_bottom(style,value);
}

void stub_lv_style_set_margin_left(lv_style_t * style, int32_t value) {
    lv_style_set_margin_left(style,value);
}

void stub_lv_style_set_margin_right(lv_style_t * style, int32_t value) {
    lv_style_set_margin_right(style,value);
}

void stub_lv_style_set_bg_color(lv_style_t * style, lv_color_t value) {
    lv_style_set_bg_color(style,value);
}

void stub_lv_style_set_bg_opa(lv_style_t * style, lv_opa_t value) {
    lv_style_set_bg_opa(style,value);
}

void stub_lv_style_set_bg_grad_color(lv_style_t * style, lv_color_t value) {
    lv_style_set_bg_grad_color(style,value);
}

void stub_lv_style_set_bg_grad_dir(lv_style_t * style, lv_grad_dir_t value) {
    lv_style_set_bg_grad_dir(style,value);
}

void stub_lv_style_set_bg_main_stop(lv_style_t * style, int32_t value) {
    lv_style_set_bg_main_stop(style,value);
}

void stub_lv_style_set_bg_grad_stop(lv_style_t * style, int32_t value) {
    lv_style_set_bg_grad_stop(style,value);
}

void stub_lv_style_set_bg_main_opa(lv_style_t * style, lv_opa_t value) {
    lv_style_set_bg_main_opa(style,value);
}

void stub_lv_style_set_bg_grad_opa(lv_style_t * style, lv_opa_t value) {
    lv_style_set_bg_grad_opa(style,value);
}

void stub_lv_style_set_bg_grad(lv_style_t * style, lv_grad_dsc_t * value) {
    lv_style_set_bg_grad(style,value);
}

void stub_lv_style_set_bg_image_src(lv_style_t * style, void * value) {
    lv_style_set_bg_image_src(style,value);
}

void stub_lv_style_set_bg_image_opa(lv_style_t * style, lv_opa_t value) {
    lv_style_set_bg_image_opa(style,value);
}

void stub_lv_style_set_bg_image_recolor(lv_style_t * style, lv_color_t value) {
    lv_style_set_bg_image_recolor(style,value);
}

void stub_lv_style_set_bg_image_recolor_opa(lv_style_t * style, lv_opa_t value) {
    lv_style_set_bg_image_recolor_opa(style,value);
}

void stub_lv_style_set_bg_image_tiled(lv_style_t * style, bool value) {
    lv_style_set_bg_image_tiled(style,value);
}

void stub_lv_style_set_border_color(lv_style_t * style, lv_color_t value) {
    lv_style_set_border_color(style,value);
}

void stub_lv_style_set_border_opa(lv_style_t * style, lv_opa_t value) {
    lv_style_set_border_opa(style,value);
}

void stub_lv_style_set_border_width(lv_style_t * style, int32_t value) {
    lv_style_set_border_width(style,value);
}

void stub_lv_style_set_border_side(lv_style_t * style, lv_border_side_t value) {
    lv_style_set_border_side(style,value);
}

void stub_lv_style_set_border_post(lv_style_t * style, bool value) {
    lv_style_set_border_post(style,value);
}

void stub_lv_style_set_outline_width(lv_style_t * style, int32_t value) {
    lv_style_set_outline_width(style,value);
}

void stub_lv_style_set_outline_color(lv_style_t * style, lv_color_t value) {
    lv_style_set_outline_color(style,value);
}

void stub_lv_style_set_outline_opa(lv_style_t * style, lv_opa_t value) {
    lv_style_set_outline_opa(style,value);
}

void stub_lv_style_set_outline_pad(lv_style_t * style, int32_t value) {
    lv_style_set_outline_pad(style,value);
}

void stub_lv_style_set_shadow_width(lv_style_t * style, int32_t value) {
    lv_style_set_shadow_width(style,value);
}

void stub_lv_style_set_shadow_offset_x(lv_style_t * style, int32_t value) {
    lv_style_set_shadow_offset_x(style,value);
}

void stub_lv_style_set_shadow_offset_y(lv_style_t * style, int32_t value) {
    lv_style_set_shadow_offset_y(style,value);
}

void stub_lv_style_set_shadow_spread(lv_style_t * style, int32_t value) {
    lv_style_set_shadow_spread(style,value);
}

void stub_lv_style_set_shadow_color(lv_style_t * style, lv_color_t value) {
    lv_style_set_shadow_color(style,value);
}

void stub_lv_style_set_shadow_opa(lv_style_t * style, lv_opa_t value) {
    lv_style_set_shadow_opa(style,value);
}

void stub_lv_style_set_image_opa(lv_style_t * style, lv_opa_t value) {
    lv_style_set_image_opa(style,value);
}

void stub_lv_style_set_image_recolor(lv_style_t * style, lv_color_t value) {
    lv_style_set_image_recolor(style,value);
}

void stub_lv_style_set_image_recolor_opa(lv_style_t * style, lv_opa_t value) {
    lv_style_set_image_recolor_opa(style,value);
}

void stub_lv_style_set_line_width(lv_style_t * style, int32_t value) {
    lv_style_set_line_width(style,value);
}

void stub_lv_style_set_line_dash_width(lv_style_t * style, int32_t value) {
    lv_style_set_line_dash_width(style,value);
}

void stub_lv_style_set_line_dash_gap(lv_style_t * style, int32_t value) {
    lv_style_set_line_dash_gap(style,value);
}

void stub_lv_style_set_line_rounded(lv_style_t * style, bool value) {
    lv_style_set_line_rounded(style,value);
}

void stub_lv_style_set_line_color(lv_style_t * style, lv_color_t value) {
    lv_style_set_line_color(style,value);
}

void stub_lv_style_set_line_opa(lv_style_t * style, lv_opa_t value) {
    lv_style_set_line_opa(style,value);
}

void stub_lv_style_set_arc_width(lv_style_t * style, int32_t value) {
    lv_style_set_arc_width(style,value);
}

void stub_lv_style_set_arc_rounded(lv_style_t * style, bool value) {
    lv_style_set_arc_rounded(style,value);
}

void stub_lv_style_set_arc_color(lv_style_t * style, lv_color_t value) {
    lv_style_set_arc_color(style,value);
}

void stub_lv_style_set_arc_opa(lv_style_t * style, lv_opa_t value) {
    lv_style_set_arc_opa(style,value);
}

void stub_lv_style_set_arc_image_src(lv_style_t * style, void * value) {
    lv_style_set_arc_image_src(style,value);
}

void stub_lv_style_set_text_color(lv_style_t * style, lv_color_t value) {
    lv_style_set_text_color(style,value);
}

void stub_lv_style_set_text_opa(lv_style_t * style, lv_opa_t value) {
    lv_style_set_text_opa(style,value);
}

void stub_lv_style_set_text_font(lv_style_t * style, lv_font_t * value) {
    lv_style_set_text_font(style,value);
}

void stub_lv_style_set_text_letter_space(lv_style_t * style, int32_t value) {
    lv_style_set_text_letter_space(style,value);
}

void stub_lv_style_set_text_line_space(lv_style_t * style, int32_t value) {
    lv_style_set_text_line_space(style,value);
}

void stub_lv_style_set_text_decor(lv_style_t * style, lv_text_decor_t value) {
    lv_style_set_text_decor(style,value);
}

void stub_lv_style_set_text_align(lv_style_t * style, lv_text_align_t value) {
    lv_style_set_text_align(style,value);
}

void stub_lv_style_set_radius(lv_style_t * style, int32_t value) {
    lv_style_set_radius(style,value);
}

void stub_lv_style_set_clip_corner(lv_style_t * style, bool value) {
    lv_style_set_clip_corner(style,value);
}

void stub_lv_style_set_opa(lv_style_t * style, lv_opa_t value) {
    lv_style_set_opa(style,value);
}

void stub_lv_style_set_opa_layered(lv_style_t * style, lv_opa_t value) {
    lv_style_set_opa_layered(style,value);
}

void stub_lv_style_set_color_filter_dsc(lv_style_t * style, lv_color_filter_dsc_t * value) {
    lv_style_set_color_filter_dsc(style,value);
}

void stub_lv_style_set_color_filter_opa(lv_style_t * style, lv_opa_t value) {
    lv_style_set_color_filter_opa(style,value);
}

void stub_lv_style_set_anim(lv_style_t * style, lv_anim_t * value) {
    lv_style_set_anim(style,value);
}

void stub_lv_style_set_anim_duration(lv_style_t * style, uint32_t value) {
    lv_style_set_anim_duration(style,value);
}

void stub_lv_style_set_transition(lv_style_t * style, lv_style_transition_dsc_t * value) {
    lv_style_set_transition(style,value);
}

void stub_lv_style_set_blend_mode(lv_style_t * style, lv_blend_mode_t value) {
    lv_style_set_blend_mode(style,value);
}

void stub_lv_style_set_layout(lv_style_t * style, uint16_t value) {
    lv_style_set_layout(style,value);
}

void stub_lv_style_set_base_dir(lv_style_t * style, lv_base_dir_t value) {
    lv_style_set_base_dir(style,value);
}

void stub_lv_style_set_bitmap_mask_src(lv_style_t * style, void * value) {
    lv_style_set_bitmap_mask_src(style,value);
}

void stub_lv_style_set_rotary_sensitivity(lv_style_t * style, uint32_t value) {
    lv_style_set_rotary_sensitivity(style,value);
}

void stub_lv_style_set_flex_flow(lv_style_t * style, lv_flex_flow_t value) {
    lv_style_set_flex_flow(style,value);
}

void stub_lv_style_set_flex_main_place(lv_style_t * style, lv_flex_align_t value) {
    lv_style_set_flex_main_place(style,value);
}

void stub_lv_style_set_flex_cross_place(lv_style_t * style, lv_flex_align_t value) {
    lv_style_set_flex_cross_place(style,value);
}

void stub_lv_style_set_flex_track_place(lv_style_t * style, lv_flex_align_t value) {
    lv_style_set_flex_track_place(style,value);
}

void stub_lv_style_set_flex_grow(lv_style_t * style, uint8_t value) {
    lv_style_set_flex_grow(style,value);
}

void stub_lv_style_set_grid_column_dsc_array(lv_style_t * style, int32_t * value) {
    lv_style_set_grid_column_dsc_array(style,value);
}

void stub_lv_style_set_grid_column_align(lv_style_t * style, lv_grid_align_t value) {
    lv_style_set_grid_column_align(style,value);
}

void stub_lv_style_set_grid_row_dsc_array(lv_style_t * style, int32_t * value) {
    lv_style_set_grid_row_dsc_array(style,value);
}

void stub_lv_style_set_grid_row_align(lv_style_t * style, lv_grid_align_t value) {
    lv_style_set_grid_row_align(style,value);
}

void stub_lv_style_set_grid_cell_column_pos(lv_style_t * style, int32_t value) {
    lv_style_set_grid_cell_column_pos(style,value);
}

void stub_lv_style_set_grid_cell_x_align(lv_style_t * style, lv_grid_align_t value) {
    lv_style_set_grid_cell_x_align(style,value);
}

void stub_lv_style_set_grid_cell_column_span(lv_style_t * style, int32_t value) {
    lv_style_set_grid_cell_column_span(style,value);
}

void stub_lv_style_set_grid_cell_row_pos(lv_style_t * style, int32_t value) {
    lv_style_set_grid_cell_row_pos(style,value);
}

void stub_lv_style_set_grid_cell_y_align(lv_style_t * style, lv_grid_align_t value) {
    lv_style_set_grid_cell_y_align(style,value);
}

void stub_lv_style_set_grid_cell_row_span(lv_style_t * style, int32_t value) {
    lv_style_set_grid_cell_row_span(style,value);
}

void stub_lv_style_set_size(lv_style_t * style, int32_t width, int32_t height) {
    lv_style_set_size(style,width,height);
}

void stub_lv_style_set_pad_all(lv_style_t * style, int32_t value) {
    lv_style_set_pad_all(style,value);
}

void stub_lv_style_set_pad_hor(lv_style_t * style, int32_t value) {
    lv_style_set_pad_hor(style,value);
}

void stub_lv_style_set_pad_ver(lv_style_t * style, int32_t value) {
    lv_style_set_pad_ver(style,value);
}

void stub_lv_style_set_pad_gap(lv_style_t * style, int32_t value) {
    lv_style_set_pad_gap(style,value);
}

void stub_lv_style_set_margin_all(lv_style_t * style, int32_t value) {
    lv_style_set_margin_all(style,value);
}

void stub_lv_style_set_transform_scale(lv_style_t * style, int32_t value) {
    lv_style_set_transform_scale(style,value);
}

/*
Do not pass multiple flags to this function as backwards-compatibility is not guaranteed for that. 

true if the flag is set for this property  
*/
bool stub_lv_style_prop_has_flag(lv_style_prop_t prop, uint8_t flag) {
    return lv_style_prop_has_flag(prop,flag);
}

lv_result_t stub_lv_event_send(lv_event_list_t * list, lv_event_t * e, bool preprocess) {
    return lv_event_send(list,e,preprocess);
}

lv_event_dsc_t * stub_lv_event_add(lv_event_list_t * list, lv_event_cb_t cb, lv_event_code_t filter, void * user_data) {
    return lv_event_add(list,cb,filter,user_data);
}

bool stub_lv_event_remove_dsc(lv_event_list_t * list, lv_event_dsc_t * dsc) {
    return lv_event_remove_dsc(list,dsc);
}

uint32_t stub_lv_event_get_count(lv_event_list_t * list) {
    return lv_event_get_count(list);
}

lv_event_dsc_t * stub_lv_event_get_dsc(lv_event_list_t * list, uint32_t index) {
    return lv_event_get_dsc(list,index);
}

lv_event_cb_t stub_lv_event_dsc_get_cb(lv_event_dsc_t * dsc) {
    return lv_event_dsc_get_cb(dsc);
}

void * stub_lv_event_dsc_get_user_data(lv_event_dsc_t * dsc) {
    return lv_event_dsc_get_user_data(dsc);
}

bool stub_lv_event_remove(lv_event_list_t * list, uint32_t index) {
    return lv_event_remove(list,index);
}

void stub_lv_event_remove_all(lv_event_list_t * list) {
    lv_event_remove_all(list);
}

/*
Get the object originally targeted by the event. It's the same even if the event is bubbled. the target of the event_code 
*/
void * stub_lv_event_get_target(lv_event_t * e) {
    return lv_event_get_target(e);
}

/*
Get the current target of the event. It's the object which event handler being called. If the event is not bubbled it's the same as "normal" target. pointer to the current target of the event_code 
*/
void * stub_lv_event_get_current_target(lv_event_t * e) {
    return lv_event_get_current_target(e);
}

/*
Get the event code of an event the event code. (E.g. LV_EVENT_CLICKED , LV_EVENT_FOCUSED , etc) 
*/
lv_event_code_t stub_lv_event_get_code(lv_event_t * e) {
    return lv_event_get_code(e);
}

/*
Get the parameter passed when the event was sent pointer to the parameter 
*/
void * stub_lv_event_get_param(lv_event_t * e) {
    return lv_event_get_param(e);
}

/*
Get the user_data passed when the event was registered on the object pointer to the user_data 
*/
void * stub_lv_event_get_user_data(lv_event_t * e) {
    return lv_event_get_user_data(e);
}

/*
Stop the event from bubbling. This is only valid when called in the middle of an event processing chain. 
*/
void stub_lv_event_stop_bubbling(lv_event_t * e) {
    lv_event_stop_bubbling(e);
}

/*
Stop processing this event. This is only valid when called in the middle of an event processing chain. 
*/
void stub_lv_event_stop_processing(lv_event_t * e) {
    lv_event_stop_processing(e);
}

/*
Register a new, custom event ID. It can be used the same way as e.g. LV_EVENT_CLICKED to send custom events the new event id Example: uint32_t LV_EVENT_MINE = 0; ...  e = lv_event_register_id();  ...  lv_obj_send_event(obj, LV_EVENT_MINE, &some_data); 
*/
uint32_t stub_lv_event_register_id(void) {
    return lv_event_register_id();
}

/*
Initialize a file system driver with default values. It is used to ensure all fields have known values and not memory junk. After it you can set the fields. 
*/
void stub_lv_fs_drv_init(lv_fs_drv_t * drv) {
    lv_fs_drv_init(drv);
}

/*
Add a new drive 
*/
void stub_lv_fs_drv_register(lv_fs_drv_t * drv) {
    lv_fs_drv_register(drv);
}

/*
Give a pointer to a driver from its letter pointer to a driver or NULL if not found 
*/
lv_fs_drv_t * stub_lv_fs_get_drv(char letter) {
    return lv_fs_get_drv(letter);
}

/*
Test if a drive is ready or not. If the ready function was not initialized true will be returned. true: drive is ready; false: drive is not ready 
*/
bool stub_lv_fs_is_ready(char letter) {
    return lv_fs_is_ready(letter);
}

/*
Open a file LV_FS_RES_OK or any error from lv_fs_res_t enum 
*/
lv_fs_res_t stub_lv_fs_open(lv_fs_file_t * file_p, char * path, lv_fs_mode_t mode) {
    return lv_fs_open(file_p,path,mode);
}

/*
Make a path object for the memory-mapped file compatible with the file system interface 
*/
void stub_lv_fs_make_path_from_buffer(lv_fs_path_ex_t * path, char letter, void * buf, uint32_t size) {
    lv_fs_make_path_from_buffer(path,letter,buf,size);
}

/*
Close an already opened file LV_FS_RES_OK or any error from lv_fs_res_t enum 
*/
lv_fs_res_t stub_lv_fs_close(lv_fs_file_t * file_p) {
    return lv_fs_close(file_p);
}

/*
Read from a file LV_FS_RES_OK or any error from lv_fs_res_t enum 
*/
lv_fs_res_t stub_lv_fs_read(lv_fs_file_t * file_p, void * buf, uint32_t btr, uint32_t * br) {
    return lv_fs_read(file_p,buf,btr,br);
}

/*
Write into a file LV_FS_RES_OK or any error from lv_fs_res_t enum 
*/
lv_fs_res_t stub_lv_fs_write(lv_fs_file_t * file_p, void * buf, uint32_t btw, uint32_t * bw) {
    return lv_fs_write(file_p,buf,btw,bw);
}

/*
Set the position of the 'cursor' (read write pointer) in a file LV_FS_RES_OK or any error from lv_fs_res_t enum 
*/
lv_fs_res_t stub_lv_fs_seek(lv_fs_file_t * file_p, uint32_t pos, lv_fs_whence_t whence) {
    return lv_fs_seek(file_p,pos,whence);
}

/*
Give the position of the read write pointer LV_FS_RES_OK or any error from 'fs_res_t' 
*/
lv_fs_res_t stub_lv_fs_tell(lv_fs_file_t * file_p, uint32_t * pos) {
    return lv_fs_tell(file_p,pos);
}

/*
Initialize a 'fs_dir_t' variable for directory reading LV_FS_RES_OK or any error from lv_fs_res_t enum 
*/
lv_fs_res_t stub_lv_fs_dir_open(lv_fs_dir_t * rddir_p, char * path) {
    return lv_fs_dir_open(rddir_p,path);
}

/*
Read the next filename form a directory. The name of the directories will begin with '/' LV_FS_RES_OK or any error from lv_fs_res_t enum 
*/
lv_fs_res_t stub_lv_fs_dir_read(lv_fs_dir_t * rddir_p, char * fn, uint32_t fn_len) {
    return lv_fs_dir_read(rddir_p,fn,fn_len);
}

/*
Close the directory reading LV_FS_RES_OK or any error from lv_fs_res_t enum 
*/
lv_fs_res_t stub_lv_fs_dir_close(lv_fs_dir_t * rddir_p) {
    return lv_fs_dir_close(rddir_p);
}

/*
Fill a buffer with the letters of existing drivers the buffer 
*/
char * stub_lv_fs_get_letters(char * buf) {
    return lv_fs_get_letters(buf);
}

/*
Return with the extension of the filename pointer to the beginning extension or empty string if no extension 
*/
char * stub_lv_fs_get_ext(char * fn) {
    return lv_fs_get_ext(fn);
}

/*
Step up one level the truncated file name 
*/
char * stub_lv_fs_up(char * path) {
    return lv_fs_up(path);
}

/*
Get the last element of a path (e.g. U:/folder/file -> file) pointer to the beginning of the last element in the path 
*/
char * stub_lv_fs_get_last(char * path) {
    return lv_fs_get_last(path);
}

/*
Get information about an image. Try the created image decoder one by one. Once one is able to get info that info will be used. LV_RESULT_OK: success; LV_RESULT_INVALID: wasn't able to get info about the image 
*/
lv_result_t stub_lv_image_decoder_get_info(void * src, lv_image_header_t * header) {
    return lv_image_decoder_get_info(src,header);
}

/*
Open an image. Try the created image decoders one by one. Once one is able to open the image that decoder is saved in dsc  LV_RESULT_OK: opened the image. dsc->decoded and dsc->header are set. LV_RESULT_INVALID: none of the registered image decoders were able to open the image. 
*/
lv_result_t stub_lv_image_decoder_open(lv_image_decoder_dsc_t * dsc, void * src, lv_image_decoder_args_t * args) {
    return lv_image_decoder_open(dsc,src,args);
}

/*
Decode full_area pixels incrementally by calling in a loop. Set decoded_area to LV_COORD_MIN on first call. LV_RESULT_OK: success; LV_RESULT_INVALID: an error occurred or there is nothing left to decode 
*/
lv_result_t stub_lv_image_decoder_get_area(lv_image_decoder_dsc_t * dsc, lv_area_t * full_area, lv_area_t * decoded_area) {
    return lv_image_decoder_get_area(dsc,full_area,decoded_area);
}

/*
Close a decoding session 
*/
void stub_lv_image_decoder_close(lv_image_decoder_dsc_t * dsc) {
    lv_image_decoder_close(dsc);
}

/*
Create a new image decoder pointer to the new image decoder 
*/
lv_image_decoder_t * stub_lv_image_decoder_create(void) {
    return lv_image_decoder_create();
}

/*
Delete an image decoder 
*/
void stub_lv_image_decoder_delete(lv_image_decoder_t * decoder) {
    lv_image_decoder_delete(decoder);
}

/*
Get the next image decoder in the linked list of image decoders the next image decoder or NULL if no more image decoder exists 
*/
lv_image_decoder_t * stub_lv_image_decoder_get_next(lv_image_decoder_t * decoder) {
    return lv_image_decoder_get_next(decoder);
}

/*
Set a callback to get information about the image 
*/
void stub_lv_image_decoder_set_info_cb(lv_image_decoder_t * decoder, lv_image_decoder_info_f_t info_cb) {
    lv_image_decoder_set_info_cb(decoder,info_cb);
}

/*
Set a callback to open an image 
*/
void stub_lv_image_decoder_set_open_cb(lv_image_decoder_t * decoder, lv_image_decoder_open_f_t open_cb) {
    lv_image_decoder_set_open_cb(decoder,open_cb);
}

/*
Set a callback to a decoded line of an image 
*/
void stub_lv_image_decoder_set_get_area_cb(lv_image_decoder_t * decoder, lv_image_decoder_get_area_cb_t read_line_cb) {
    lv_image_decoder_set_get_area_cb(decoder,read_line_cb);
}

/*
Set a callback to close a decoding session. E.g. close files and free other resources. 
*/
void stub_lv_image_decoder_set_close_cb(lv_image_decoder_t * decoder, lv_image_decoder_close_f_t close_cb) {
    lv_image_decoder_set_close_cb(decoder,close_cb);
}

lv_cache_entry_t * stub_lv_image_decoder_add_to_cache(lv_image_decoder_t * decoder, lv_image_cache_data_t * search_key, lv_draw_buf_t * decoded, void * user_data) {
    return lv_image_decoder_add_to_cache(decoder,search_key,decoded,user_data);
}

/*
Check the decoded image, make any modification if decoder args requires. A new draw buf will be allocated if provided decoded is not modifiable or stride mismatch etc.  post processed draw buffer, when it differs with decoded , it's newly allocated. 
*/
lv_draw_buf_t * stub_lv_image_decoder_post_process(lv_image_decoder_dsc_t * dsc, lv_draw_buf_t * decoded) {
    return lv_image_decoder_post_process(dsc,decoded);
}

/*
Used internally to initialize the drawing module 
*/
void stub_lv_draw_init(void) {
    lv_draw_init();
}

/*
Deinitialize the drawing module 
*/
void stub_lv_draw_deinit(void) {
    lv_draw_deinit();
}

/*
Allocate a new draw unit with the given size and appends it to the list of draw units 
*/
void * stub_lv_draw_create_unit(size_t size) {
    return lv_draw_create_unit(size);
}

/*
Add an empty draw task to the draw task list of a layer. the created draw task which needs to be further configured e.g. by added a draw descriptor 
*/
lv_draw_task_t * stub_lv_draw_add_task(lv_layer_t * layer, lv_area_t * coords) {
    return lv_draw_add_task(layer,coords);
}

/*
Needs to be called when a draw task is created and configured. It will send an event about the new draw task to the widget and assign it to a draw unit. 
*/
void stub_lv_draw_finalize_task_creation(lv_layer_t * layer, lv_draw_task_t * t) {
    lv_draw_finalize_task_creation(layer,t);
}

/*
Try dispatching draw tasks to draw units 
*/
void stub_lv_draw_dispatch(void) {
    lv_draw_dispatch();
}

/*
Used internally to try dispatching draw tasks of a specific layer at least one draw task is being rendered (maybe it was taken earlier) 
*/
bool stub_lv_draw_dispatch_layer(lv_display_t * disp, lv_layer_t * layer) {
    return lv_draw_dispatch_layer(disp,layer);
}

/*
Wait for a new dispatch request. It's blocking if LV_USE_OS == 0 else it yields 
*/
void stub_lv_draw_dispatch_wait_for_request(void) {
    lv_draw_dispatch_wait_for_request();
}

/*
Wait for draw finish in case of asynchronous task execution. If LV_USE_OS == 0 it just return. 
*/
void stub_lv_draw_wait_for_finish(void) {
    lv_draw_wait_for_finish();
}

/*
When a draw unit finished a draw task it needs to request dispatching to let LVGL assign a new draw task to it 
*/
void stub_lv_draw_dispatch_request(void) {
    lv_draw_dispatch_request();
}

/*
Get the total number of draw units. 
*/
uint32_t stub_lv_draw_get_unit_count(void) {
    return lv_draw_get_unit_count();
}

/*
Find and available draw task tan available draw task or NULL if there is no any 
*/
lv_draw_task_t * stub_lv_draw_get_next_available_task(lv_layer_t * layer, lv_draw_task_t * t_prev, uint8_t draw_unit_id) {
    return lv_draw_get_next_available_task(layer,t_prev,draw_unit_id);
}

/*
Tell how many draw task are waiting to be drawn on the area of t_check . It can be used to determine if a GPU shall combine many draw tasks into one or not. If a lot of tasks are waiting for the current ones it makes sense to draw them one-by-one to not block the dependent tasks' rendering number of tasks depending on t_check 
*/
uint32_t stub_lv_draw_get_dependent_count(lv_draw_task_t * t_check) {
    return lv_draw_get_dependent_count(t_check);
}

/*
Create (allocate) a new layer on a parent layer the new target_layer or NULL on error 
*/
lv_layer_t * stub_lv_draw_layer_create(lv_layer_t * parent_layer, lv_color_format_t color_format, lv_area_t * area) {
    return lv_draw_layer_create(parent_layer,color_format,area);
}

/*
Initialize a layer which is allocated by the user the new target_layer or NULL on error 
*/
void stub_lv_draw_layer_init(lv_layer_t * layer, lv_layer_t * parent_layer, lv_color_format_t color_format, lv_area_t * area) {
    lv_draw_layer_init(layer,parent_layer,color_format,area);
}

/*
Try to allocate a buffer for the layer. pointer to the allocated aligned buffer or NULL on failure 
*/
void * stub_lv_draw_layer_alloc_buf(lv_layer_t * layer) {
    return lv_draw_layer_alloc_buf(layer);
}

/*
Got to a pixel at X and Y coordinate on a layer buf offset to point to the given X and Y coordinate 
*/
void * stub_lv_draw_layer_go_to_xy(lv_layer_t * layer, int32_t x, int32_t y) {
    return lv_draw_layer_go_to_xy(layer,x,y);
}

/*
Get the type of a draw task the draw task type 
*/
lv_draw_task_type_t stub_lv_draw_task_get_type(lv_draw_task_t * t) {
    return lv_draw_task_get_type(t);
}

/*
Get the draw descriptor of a draw task a void pointer to the draw descriptor 
*/
void * stub_lv_draw_task_get_draw_dsc(lv_draw_task_t * t) {
    return lv_draw_task_get_draw_dsc(t);
}

/*
Get the draw area of a draw task 
*/
void stub_lv_draw_task_get_area(lv_draw_task_t * t, lv_area_t * area) {
    lv_draw_task_get_area(t,area);
}

/*
Create a new display with the given resolution pointer to a display object or NULL on error 
*/
lv_display_t * stub_lv_display_create(int32_t hor_res, int32_t ver_res) {
    return lv_display_create(hor_res,ver_res);
}

/*
Remove a display 
*/
void stub_lv_display_delete(lv_display_t * disp) {
    lv_display_delete(disp);
}

/*
Set a default display. The new screens will be created on it by default. 
*/
void stub_lv_display_set_default(lv_display_t * disp) {
    lv_display_set_default(disp);
}

/*
Get the default display pointer to the default display 
*/
lv_display_t * stub_lv_display_get_default(void) {
    return lv_display_get_default();
}

/*
Get the next display. the next display or NULL if no more. Gives the first display when the parameter is NULL. 
*/
lv_display_t * stub_lv_display_get_next(lv_display_t * disp) {
    return lv_display_get_next(disp);
}

/*
Sets the resolution of a display. LV_EVENT_RESOLUTION_CHANGED event will be sent. Here the native resolution of the device should be set. If the display will be rotated later with lv_display_set_rotation LVGL will swap the hor. and ver. resolution automatically. 
*/
void stub_lv_display_set_resolution(lv_display_t * disp, int32_t hor_res, int32_t ver_res) {
    lv_display_set_resolution(disp,hor_res,ver_res);
}

/*
It's not mandatory to use the whole display for LVGL, however in some cases physical resolution is important. For example the touchpad still sees whole resolution and the values needs to be converted to the active LVGL display area. 
*/
void stub_lv_display_set_physical_resolution(lv_display_t * disp, int32_t hor_res, int32_t ver_res) {
    lv_display_set_physical_resolution(disp,hor_res,ver_res);
}

/*
If physical resolution is not the same as the normal resolution the offset of the active display area can be set here. 
*/
void stub_lv_display_set_offset(lv_display_t * disp, int32_t x, int32_t y) {
    lv_display_set_offset(disp,x,y);
}

/*
Set the rotation of this display. LVGL will swap the horizontal and vertical resolutions internally. 
*/
void stub_lv_display_set_rotation(lv_display_t * disp, lv_display_rotation_t rotation) {
    lv_display_set_rotation(disp,rotation);
}

/*
Set the DPI (dot per inch) of the display. dpi = sqrt(hor_res^2 + ver_res^2) / diagonal" 
*/
void stub_lv_display_set_dpi(lv_display_t * disp, int32_t dpi) {
    lv_display_set_dpi(disp,dpi);
}

/*
Get the horizontal resolution of a display. the horizontal resolution of the display. 
*/
int32_t stub_lv_display_get_horizontal_resolution(lv_display_t * disp) {
    return lv_display_get_horizontal_resolution(disp);
}

/*
Get the vertical resolution of a display the vertical resolution of the display 
*/
int32_t stub_lv_display_get_vertical_resolution(lv_display_t * disp) {
    return lv_display_get_vertical_resolution(disp);
}

/*
Get the physical horizontal resolution of a display the physical horizontal resolution of the display 
*/
int32_t stub_lv_display_get_physical_horizontal_resolution(lv_display_t * disp) {
    return lv_display_get_physical_horizontal_resolution(disp);
}

/*
Get the physical vertical resolution of a display the physical vertical resolution of the display 
*/
int32_t stub_lv_display_get_physical_vertical_resolution(lv_display_t * disp) {
    return lv_display_get_physical_vertical_resolution(disp);
}

/*
Get the horizontal offset from the full / physical display the horizontal offset from the physical display 
*/
int32_t stub_lv_display_get_offset_x(lv_display_t * disp) {
    return lv_display_get_offset_x(disp);
}

/*
Get the vertical offset from the full / physical display the horizontal offset from the physical display 
*/
int32_t stub_lv_display_get_offset_y(lv_display_t * disp) {
    return lv_display_get_offset_y(disp);
}

/*
Get the current rotation of this display. the current rotation 
*/
lv_display_rotation_t stub_lv_display_get_rotation(lv_display_t * disp) {
    return lv_display_get_rotation(disp);
}

/*
Get the DPI of the display dpi of the display 
*/
int32_t stub_lv_display_get_dpi(lv_display_t * disp) {
    return lv_display_get_dpi(disp);
}

/*
Set the buffers for a display, similarly to lv_display_set_draw_buffers , but accept the raw buffer pointers. For DIRECT/FULL rending modes, the buffer size must be at least hor_res * ver_res * lv_color_format_get_size(lv_display_get_color_format(disp)) 
*/
void stub_lv_display_set_buffers(lv_display_t * disp, void * buf1, void * buf2, uint32_t buf_size, lv_display_render_mode_t render_mode) {
    lv_display_set_buffers(disp,buf1,buf2,buf_size,render_mode);
}

/*
Set the buffers for a display, accept a draw buffer pointer. Normally use lv_display_set_buffers is enough for most cases. Use this function when an existing lv_draw_buf_t is available. 
*/
void stub_lv_display_set_draw_buffers(lv_display_t * disp, lv_draw_buf_t * buf1, lv_draw_buf_t * buf2) {
    lv_display_set_draw_buffers(disp,buf1,buf2);
}

/*
Set display render mode 
*/
void stub_lv_display_set_render_mode(lv_display_t * disp, lv_display_render_mode_t render_mode) {
    lv_display_set_render_mode(disp,render_mode);
}

/*
Set the flush callback which will be called to copy the rendered image to the display. 
*/
void stub_lv_display_set_flush_cb(lv_display_t * disp, lv_display_flush_cb_t flush_cb) {
    lv_display_set_flush_cb(disp,flush_cb);
}

/*
Set a callback to be used while LVGL is waiting flushing to be finished. It can do any complex logic to wait, including semaphores, mutexes, polling flags, etc. If not set the disp->flushing flag is used which can be cleared with lv_display_flush_ready() 
*/
void stub_lv_display_set_flush_wait_cb(lv_display_t * disp, lv_display_flush_wait_cb_t wait_cb) {
    lv_display_set_flush_wait_cb(disp,wait_cb);
}

/*
Set the color format of the display. To change the endianness of the rendered image in case of RGB565 format (i.e. swap the 2 bytes) call lv_draw_sw_rgb565_swap in the flush_cb 
*/
void stub_lv_display_set_color_format(lv_display_t * disp, lv_color_format_t color_format) {
    lv_display_set_color_format(disp,color_format);
}

/*
Get the color format of the display the color format 
*/
lv_color_format_t stub_lv_display_get_color_format(lv_display_t * disp) {
    return lv_display_get_color_format(disp);
}

/*
Set the number of tiles for parallel rendering. 
*/
void stub_lv_display_set_tile_cnt(lv_display_t * disp, uint32_t tile_cnt) {
    lv_display_set_tile_cnt(disp,tile_cnt);
}

/*
Get the number of tiles used for parallel rendering number of tiles 
*/
uint32_t stub_lv_display_get_tile_cnt(lv_display_t * disp) {
    return lv_display_get_tile_cnt(disp);
}

/*
Enable anti-aliasing for the render engine 
*/
void stub_lv_display_set_antialiasing(lv_display_t * disp, bool en) {
    lv_display_set_antialiasing(disp,en);
}

/*
Get if anti-aliasing is enabled for a display or not true/false 
*/
bool stub_lv_display_get_antialiasing(lv_display_t * disp) {
    return lv_display_get_antialiasing(disp);
}

void stub_lv_display_flush_ready(lv_display_t * disp) {
    lv_display_flush_ready(disp);
}

bool stub_lv_display_flush_is_last(lv_display_t * disp) {
    return lv_display_flush_is_last(disp);
}

bool stub_lv_display_is_double_buffered(lv_display_t * disp) {
    return lv_display_is_double_buffered(disp);
}

/*
Return a pointer to the active screen on a display pointer to the active screen object (loaded by ' :ref:`lv_screen_load()` ') 
*/
lv_obj_t * stub_lv_display_get_screen_active(lv_display_t * disp) {
    return lv_display_get_screen_active(disp);
}

/*
Return with a pointer to the previous screen. Only used during screen transitions. pointer to the previous screen object or NULL if not used now 
*/
lv_obj_t * stub_lv_display_get_screen_prev(lv_display_t * disp) {
    return lv_display_get_screen_prev(disp);
}

/*
Return the top layer. The top layer is the same on all screens and it is above the normal screen layer. pointer to the top layer object 
*/
lv_obj_t * stub_lv_display_get_layer_top(lv_display_t * disp) {
    return lv_display_get_layer_top(disp);
}

/*
Return the sys. layer. The system layer is the same on all screen and it is above the normal screen and the top layer. pointer to the sys layer object 
*/
lv_obj_t * stub_lv_display_get_layer_sys(lv_display_t * disp) {
    return lv_display_get_layer_sys(disp);
}

/*
Return the bottom layer. The bottom layer is the same on all screen and it is under the normal screen layer. It's visible only if the screen is transparent. pointer to the bottom layer object 
*/
lv_obj_t * stub_lv_display_get_layer_bottom(lv_display_t * disp) {
    return lv_display_get_layer_bottom(disp);
}

/*
Load a screen on the default display 
*/
void stub_lv_screen_load(struct _lv_obj_t * scr) {
    lv_screen_load(scr);
}

/*
Switch screen with animation 
*/
void stub_lv_screen_load_anim(lv_obj_t * scr, lv_screen_load_anim_t anim_type, uint32_t time, uint32_t delay, bool auto_del) {
    lv_screen_load_anim(scr,anim_type,time,delay,auto_del);
}

/*
Get the active screen of the default display pointer to the active screen 
*/
lv_obj_t * stub_lv_screen_active(void) {
    return lv_screen_active();
}

/*
Get the top layer of the default display pointer to the top layer 
*/
lv_obj_t * stub_lv_layer_top(void) {
    return lv_layer_top();
}

/*
Get the system layer of the default display pointer to the sys layer 
*/
lv_obj_t * stub_lv_layer_sys(void) {
    return lv_layer_sys();
}

/*
Get the bottom layer of the default display pointer to the bottom layer 
*/
lv_obj_t * stub_lv_layer_bottom(void) {
    return lv_layer_bottom();
}

/*
Add an event handler to the display 
*/
void stub_lv_display_add_event_cb(lv_display_t * disp, lv_event_cb_t event_cb, lv_event_code_t filter, void * user_data) {
    lv_display_add_event_cb(disp,event_cb,filter,user_data);
}

/*
Get the number of event attached to a display number of events 
*/
uint32_t stub_lv_display_get_event_count(lv_display_t * disp) {
    return lv_display_get_event_count(disp);
}

/*
Get an event descriptor for an event the event descriptor 
*/
lv_event_dsc_t * stub_lv_display_get_event_dsc(lv_display_t * disp, uint32_t index) {
    return lv_display_get_event_dsc(disp,index);
}

/*
Remove an event true: and event was removed; false: no event was removed 
*/
bool stub_lv_display_delete_event(lv_display_t * disp, uint32_t index) {
    return lv_display_delete_event(disp,index);
}

/*
Remove an event_cb with user_data the count of the event removed 
*/
uint32_t stub_lv_display_remove_event_cb_with_user_data(lv_display_t * disp, lv_event_cb_t event_cb, void * user_data) {
    return lv_display_remove_event_cb_with_user_data(disp,event_cb,user_data);
}

/*
Send an event to a display LV_RESULT_OK: disp wasn't deleted in the event. 
*/
lv_result_t stub_lv_display_send_event(lv_display_t * disp, lv_event_code_t code, void * param) {
    return lv_display_send_event(disp,code,param);
}

/*
Get the area to be invalidated. Can be used in LV_EVENT_INVALIDATE_AREA  the area to invalidated (can be modified as required) 
*/
lv_area_t * stub_lv_event_get_invalidated_area(lv_event_t * e) {
    return lv_event_get_invalidated_area(e);
}

/*
Set the theme of a display. If there are no user created widgets yet the screens' theme will be updated 
*/
void stub_lv_display_set_theme(lv_display_t * disp, lv_theme_t * th) {
    lv_display_set_theme(disp,th);
}

/*
Get the theme of a display the display's theme (can be NULL) 
*/
lv_theme_t * stub_lv_display_get_theme(lv_display_t * disp) {
    return lv_display_get_theme(disp);
}

/*
Get elapsed time since last user activity on a display (e.g. click) elapsed ticks (milliseconds) since the last activity 
*/
uint32_t stub_lv_display_get_inactive_time(lv_display_t * disp) {
    return lv_display_get_inactive_time(disp);
}

/*
Manually trigger an activity on a display 
*/
void stub_lv_display_trigger_activity(lv_display_t * disp) {
    lv_display_trigger_activity(disp);
}

/*
Temporarily enable and disable the invalidation of the display. 
*/
void stub_lv_display_enable_invalidation(lv_display_t * disp, bool en) {
    lv_display_enable_invalidation(disp,en);
}

/*
Get display invalidation is enabled. return true if invalidation is enabled 
*/
bool stub_lv_display_is_invalidation_enabled(lv_display_t * disp) {
    return lv_display_is_invalidation_enabled(disp);
}

/*
Get a pointer to the screen refresher timer to modify its parameters with lv_timer_... functions. pointer to the display refresher timer. (NULL on error) 
*/
lv_timer_t * stub_lv_display_get_refr_timer(lv_display_t * disp) {
    return lv_display_get_refr_timer(disp);
}

/*
Delete screen refresher timer 
*/
void stub_lv_display_delete_refr_timer(lv_display_t * disp) {
    lv_display_delete_refr_timer(disp);
}

void stub_lv_display_set_user_data(lv_display_t * disp, void * user_data) {
    lv_display_set_user_data(disp,user_data);
}

void stub_lv_display_set_driver_data(lv_display_t * disp, void * driver_data) {
    lv_display_set_driver_data(disp,driver_data);
}

void * stub_lv_display_get_user_data(lv_display_t * disp) {
    return lv_display_get_user_data(disp);
}

void * stub_lv_display_get_driver_data(lv_display_t * disp) {
    return lv_display_get_driver_data(disp);
}

lv_draw_buf_t * stub_lv_display_get_buf_active(lv_display_t * disp) {
    return lv_display_get_buf_active(disp);
}

/*
Rotate an area in-place according to the display's rotation 
*/
void stub_lv_display_rotate_area(lv_display_t * disp, lv_area_t * area) {
    lv_display_rotate_area(disp,area);
}

/*
Scale the given number of pixels (a distance or size) relative to a 160 DPI display considering the DPI of the default display. It ensures that e.g. lv_dpx(100) will have the same physical size regardless to the DPI of the display. n x current_dpi/160 
*/
int32_t stub_lv_dpx(int32_t n) {
    return lv_dpx(n);
}

/*
Scale the given number of pixels (a distance or size) relative to a 160 DPI display considering the DPI of the given display. It ensures that e.g. lv_dpx(100) will have the same physical size regardless to the DPI of the display. n x current_dpi/160 
*/
int32_t stub_lv_display_dpx(lv_display_t * disp, int32_t n) {
    return lv_display_dpx(disp,n);
}

/*
Delete an object and all of its children. Also remove the objects from their group and remove all animations (if any). Send LV_EVENT_DELETED to deleted objects. 
*/
void stub_lv_obj_delete(lv_obj_t * obj) {
    lv_obj_delete(obj);
}

/*
Delete all children of an object. Also remove the objects from their group and remove all animations (if any). Send LV_EVENT_DELETED to deleted objects. 
*/
void stub_lv_obj_clean(lv_obj_t * obj) {
    lv_obj_clean(obj);
}

/*
Delete an object after some delay 
*/
void stub_lv_obj_delete_delayed(lv_obj_t * obj, uint32_t delay_ms) {
    lv_obj_delete_delayed(obj,delay_ms);
}

/*
A function to be easily used in animation ready callback to delete an object when the animation is ready 
*/
void stub_lv_obj_delete_anim_completed_cb(lv_anim_t * a) {
    lv_obj_delete_anim_completed_cb(a);
}

/*
Helper function for asynchronously deleting objects. Useful for cases where you can't delete an object directly in an LV_EVENT_DELETE handler (i.e. parent). :ref:`lv_async_call` 
*/
void stub_lv_obj_delete_async(lv_obj_t * obj) {
    lv_obj_delete_async(obj);
}

/*
Move the parent of an object. The relative coordinates will be kept. 
*/
void stub_lv_obj_set_parent(lv_obj_t * obj, lv_obj_t * parent) {
    lv_obj_set_parent(obj,parent);
}

/*
Swap the positions of two objects. When used in listboxes, it can be used to sort the listbox items. 
*/
void stub_lv_obj_swap(lv_obj_t * obj1, lv_obj_t * obj2) {
    lv_obj_swap(obj1,obj2);
}

/*
moves the object to the given index in its parent. When used in listboxes, it can be used to sort the listbox items. to move to the background: lv_obj_move_to_index(obj, 0)  to move forward (up): lv_obj_move_to_index(obj, lv_obj_get_index(obj) - 1) 
*/
void stub_lv_obj_move_to_index(lv_obj_t * obj, int32_t index) {
    lv_obj_move_to_index(obj,index);
}

/*
Get the screen of an object pointer to the object's screen 
*/
lv_obj_t * stub_lv_obj_get_screen(lv_obj_t * obj) {
    return lv_obj_get_screen(obj);
}

/*
Get the display of the object pointer to the object's display 
*/
lv_display_t * stub_lv_obj_get_display(lv_obj_t * obj) {
    return lv_obj_get_display(obj);
}

/*
Get the parent of an object the parent of the object. (NULL if obj was a screen) 
*/
lv_obj_t * stub_lv_obj_get_parent(lv_obj_t * obj) {
    return lv_obj_get_parent(obj);
}

/*
Get the child of an object by the child's index. pointer to the child or NULL if the index was invalid 
*/
lv_obj_t * stub_lv_obj_get_child(lv_obj_t * obj, int32_t idx) {
    return lv_obj_get_child(obj,idx);
}

/*
Get the child of an object by the child's index. Consider the children only with a given type. pointer to the child or NULL if the index was invalid 
*/
lv_obj_t * stub_lv_obj_get_child_by_type(lv_obj_t * obj, int32_t idx, lv_obj_class_t * class_p) {
    return lv_obj_get_child_by_type(obj,idx,class_p);
}

/*
Return a sibling of an object pointer to the requested sibling or NULL if there is no such sibling 
*/
lv_obj_t * stub_lv_obj_get_sibling(lv_obj_t * obj, int32_t idx) {
    return lv_obj_get_sibling(obj,idx);
}

/*
Return a sibling of an object. Consider the siblings only with a given type. pointer to the requested sibling or NULL if there is no such sibling 
*/
lv_obj_t * stub_lv_obj_get_sibling_by_type(lv_obj_t * obj, int32_t idx, lv_obj_class_t * class_p) {
    return lv_obj_get_sibling_by_type(obj,idx,class_p);
}

/*
Get the number of children the number of children 
*/
uint32_t stub_lv_obj_get_child_count(lv_obj_t * obj) {
    return lv_obj_get_child_count(obj);
}

/*
Get the number of children having a given type. the number of children 
*/
uint32_t stub_lv_obj_get_child_count_by_type(lv_obj_t * obj, lv_obj_class_t * class_p) {
    return lv_obj_get_child_count_by_type(obj,class_p);
}

/*
Get the index of a child. the child index of the object. E.g. 0: the oldest (firstly created child). (-1 if child could not be found or no parent exists) 
*/
int32_t stub_lv_obj_get_index(lv_obj_t * obj) {
    return lv_obj_get_index(obj);
}

/*
Get the index of a child. Consider the children only with a given type. the child index of the object. E.g. 0: the oldest (firstly created child with the given class). (-1 if child could not be found or no parent exists) 
*/
int32_t stub_lv_obj_get_index_by_type(lv_obj_t * obj, lv_obj_class_t * class_p) {
    return lv_obj_get_index_by_type(obj,class_p);
}

/*
Iterate through all children of any object. 
*/
void stub_lv_obj_tree_walk(lv_obj_t * start_obj, lv_obj_tree_walk_cb_t cb, void * user_data) {
    lv_obj_tree_walk(start_obj,cb,user_data);
}

/*
Iterate through all children of any object and print their ID. 
*/
void stub_lv_obj_dump_tree(lv_obj_t * start_obj) {
    lv_obj_dump_tree(start_obj);
}

/*
Set the position of an object relative to the set alignment. With default alignment it's the distance from the top left corner  E.g. LV_ALIGN_CENTER alignment it's the offset from the center of the parent  The position is interpreted on the content area of the parent  The values can be set in pixel or in percentage of parent size with lv_pct(v) 
*/
void stub_lv_obj_set_pos(lv_obj_t * obj, int32_t x, int32_t y) {
    lv_obj_set_pos(obj,x,y);
}

/*
Set the x coordinate of an object With default alignment it's the distance from the top left corner  E.g. LV_ALIGN_CENTER alignment it's the offset from the center of the parent  The position is interpreted on the content area of the parent  The values can be set in pixel or in percentage of parent size with lv_pct(v) 
*/
void stub_lv_obj_set_x(lv_obj_t * obj, int32_t x) {
    lv_obj_set_x(obj,x);
}

/*
Set the y coordinate of an object With default alignment it's the distance from the top left corner  E.g. LV_ALIGN_CENTER alignment it's the offset from the center of the parent  The position is interpreted on the content area of the parent  The values can be set in pixel or in percentage of parent size with lv_pct(v) 
*/
void stub_lv_obj_set_y(lv_obj_t * obj, int32_t y) {
    lv_obj_set_y(obj,y);
}

/*
Set the size of an object. possible values are: pixel simple set the size accordingly LV_SIZE_CONTENT set the size to involve all children in the given direction lv_pct(x) to set size in percentage of the parent's content area size (the size without paddings). x should be in [0..1000]% range 
*/
void stub_lv_obj_set_size(lv_obj_t * obj, int32_t w, int32_t h) {
    lv_obj_set_size(obj,w,h);
}

/*
Recalculate the size of the object true: the size has been changed 
*/
bool stub_lv_obj_refr_size(lv_obj_t * obj) {
    return lv_obj_refr_size(obj);
}

/*
Set the width of an object possible values are: pixel simple set the size accordingly LV_SIZE_CONTENT set the size to involve all children in the given direction lv_pct(x) to set size in percentage of the parent's content area size (the size without paddings). x should be in [0..1000]% range 
*/
void stub_lv_obj_set_width(lv_obj_t * obj, int32_t w) {
    lv_obj_set_width(obj,w);
}

/*
Set the height of an object possible values are: pixel simple set the size accordingly LV_SIZE_CONTENT set the size to involve all children in the given direction lv_pct(x) to set size in percentage of the parent's content area size (the size without paddings). x should be in [0..1000]% range 
*/
void stub_lv_obj_set_height(lv_obj_t * obj, int32_t h) {
    lv_obj_set_height(obj,h);
}

/*
Set the width reduced by the left and right padding and the border width. 
*/
void stub_lv_obj_set_content_width(lv_obj_t * obj, int32_t w) {
    lv_obj_set_content_width(obj,w);
}

/*
Set the height reduced by the top and bottom padding and the border width. 
*/
void stub_lv_obj_set_content_height(lv_obj_t * obj, int32_t h) {
    lv_obj_set_content_height(obj,h);
}

/*
Set a layout for an object 
*/
void stub_lv_obj_set_layout(lv_obj_t * obj, uint32_t layout) {
    lv_obj_set_layout(obj,layout);
}

/*
Test whether the and object is positioned by a layout or not true: positioned by a layout; false: not positioned by a layout 
*/
bool stub_lv_obj_is_layout_positioned(lv_obj_t * obj) {
    return lv_obj_is_layout_positioned(obj);
}

/*
Mark the object for layout update. 
*/
void stub_lv_obj_mark_layout_as_dirty(lv_obj_t * obj) {
    lv_obj_mark_layout_as_dirty(obj);
}

/*
Update the layout of an object. 
*/
void stub_lv_obj_update_layout(lv_obj_t * obj) {
    lv_obj_update_layout(obj);
}

/*
Change the alignment of an object. 
*/
void stub_lv_obj_set_align(lv_obj_t * obj, lv_align_t align) {
    lv_obj_set_align(obj,align);
}

/*
Change the alignment of an object and set new coordinates. Equivalent to: lv_obj_set_align(obj, align); lv_obj_set_pos(obj, x_ofs, y_ofs); 
*/
void stub_lv_obj_align(lv_obj_t * obj, lv_align_t align, int32_t x_ofs, int32_t y_ofs) {
    lv_obj_align(obj,align,x_ofs,y_ofs);
}

/*
Align an object to another object. if the position or size of base changes obj needs to be aligned manually again 
*/
void stub_lv_obj_align_to(lv_obj_t * obj, lv_obj_t * base, lv_align_t align, int32_t x_ofs, int32_t y_ofs) {
    lv_obj_align_to(obj,base,align,x_ofs,y_ofs);
}

/*
Align an object to the center on its parent. if the parent size changes obj needs to be aligned manually again 
*/
void stub_lv_obj_center(lv_obj_t * obj) {
    lv_obj_center(obj);
}

/*
Copy the coordinates of an object to an area 
*/
void stub_lv_obj_get_coords(lv_obj_t * obj, lv_area_t * coords) {
    lv_obj_get_coords(obj,coords);
}

/*
Get the x coordinate of object. distance of obj from the left side of its parent plus the parent's left padding  The position of the object is recalculated only on the next redraw. To force coordinate recalculation call lv_obj_update_layout(obj) .  Zero return value means the object is on the left padding of the parent, and not on the left edge.  Scrolling of the parent doesn't change the returned value.  The returned value is always the distance from the parent even if obj is positioned by a layout. 
*/
int32_t stub_lv_obj_get_x(lv_obj_t * obj) {
    return lv_obj_get_x(obj);
}

/*
Get the x2 coordinate of object. distance of obj from the right side of its parent plus the parent's right padding  The position of the object is recalculated only on the next redraw. To force coordinate recalculation call lv_obj_update_layout(obj) .  Zero return value means the object is on the right padding of the parent, and not on the right edge.  Scrolling of the parent doesn't change the returned value.  The returned value is always the distance from the parent even if obj is positioned by a layout. 
*/
int32_t stub_lv_obj_get_x2(lv_obj_t * obj) {
    return lv_obj_get_x2(obj);
}

/*
Get the y coordinate of object. distance of obj from the top side of its parent plus the parent's top padding  The position of the object is recalculated only on the next redraw. To force coordinate recalculation call lv_obj_update_layout(obj) .  Zero return value means the object is on the top padding of the parent, and not on the top edge.  Scrolling of the parent doesn't change the returned value.  The returned value is always the distance from the parent even if obj is positioned by a layout. 
*/
int32_t stub_lv_obj_get_y(lv_obj_t * obj) {
    return lv_obj_get_y(obj);
}

/*
Get the y2 coordinate of object. distance of obj from the bottom side of its parent plus the parent's bottom padding  The position of the object is recalculated only on the next redraw. To force coordinate recalculation call lv_obj_update_layout(obj) .  Zero return value means the object is on the bottom padding of the parent, and not on the bottom edge.  Scrolling of the parent doesn't change the returned value.  The returned value is always the distance from the parent even if obj is positioned by a layout. 
*/
int32_t stub_lv_obj_get_y2(lv_obj_t * obj) {
    return lv_obj_get_y2(obj);
}

/*
Get the actually set x coordinate of object, i.e. the offset from the set alignment the set x coordinate 
*/
int32_t stub_lv_obj_get_x_aligned(lv_obj_t * obj) {
    return lv_obj_get_x_aligned(obj);
}

/*
Get the actually set y coordinate of object, i.e. the offset from the set alignment the set y coordinate 
*/
int32_t stub_lv_obj_get_y_aligned(lv_obj_t * obj) {
    return lv_obj_get_y_aligned(obj);
}

/*
Get the width of an object The position of the object is recalculated only on the next redraw. To force coordinate recalculation call lv_obj_update_layout(obj) .  the width in pixels 
*/
int32_t stub_lv_obj_get_width(lv_obj_t * obj) {
    return lv_obj_get_width(obj);
}

/*
Get the height of an object The position of the object is recalculated only on the next redraw. To force coordinate recalculation call lv_obj_update_layout(obj) .  the height in pixels 
*/
int32_t stub_lv_obj_get_height(lv_obj_t * obj) {
    return lv_obj_get_height(obj);
}

/*
Get the width reduced by the left and right padding and the border width. The position of the object is recalculated only on the next redraw. To force coordinate recalculation call lv_obj_update_layout(obj) .  the width which still fits into its parent without causing overflow (making the parent scrollable) 
*/
int32_t stub_lv_obj_get_content_width(lv_obj_t * obj) {
    return lv_obj_get_content_width(obj);
}

/*
Get the height reduced by the top and bottom padding and the border width. The position of the object is recalculated only on the next redraw. To force coordinate recalculation call lv_obj_update_layout(obj) .  the height which still fits into the parent without causing overflow (making the parent scrollable) 
*/
int32_t stub_lv_obj_get_content_height(lv_obj_t * obj) {
    return lv_obj_get_content_height(obj);
}

/*
Get the area reduced by the paddings and the border width. The position of the object is recalculated only on the next redraw. To force coordinate recalculation call lv_obj_update_layout(obj) . 
*/
void stub_lv_obj_get_content_coords(lv_obj_t * obj, lv_area_t * area) {
    lv_obj_get_content_coords(obj,area);
}

/*
Get the width occupied by the "parts" of the widget. E.g. the width of all columns of a table. the width of the virtually drawn content  This size independent from the real size of the widget. It just tells how large the internal ("virtual") content is. 
*/
int32_t stub_lv_obj_get_self_width(lv_obj_t * obj) {
    return lv_obj_get_self_width(obj);
}

/*
Get the height occupied by the "parts" of the widget. E.g. the height of all rows of a table. the width of the virtually drawn content  This size independent from the real size of the widget. It just tells how large the internal ("virtual") content is. 
*/
int32_t stub_lv_obj_get_self_height(lv_obj_t * obj) {
    return lv_obj_get_self_height(obj);
}

/*
Handle if the size of the internal ("virtual") content of an object has changed. false: nothing happened; true: refresh happened 
*/
bool stub_lv_obj_refresh_self_size(lv_obj_t * obj) {
    return lv_obj_refresh_self_size(obj);
}

void stub_lv_obj_refr_pos(lv_obj_t * obj) {
    lv_obj_refr_pos(obj);
}

void stub_lv_obj_move_to(lv_obj_t * obj, int32_t x, int32_t y) {
    lv_obj_move_to(obj,x,y);
}

void stub_lv_obj_move_children_by(lv_obj_t * obj, int32_t x_diff, int32_t y_diff, bool ignore_floating) {
    lv_obj_move_children_by(obj,x_diff,y_diff,ignore_floating);
}

/*
Transform a point using the angle and zoom style properties of an object 
*/
void stub_lv_obj_transform_point(lv_obj_t * obj, lv_point_t * p, lv_obj_point_transform_flag_t flags) {
    lv_obj_transform_point(obj,p,flags);
}

/*
Transform an array of points using the angle and zoom style properties of an object 
*/
void stub_lv_obj_transform_point_array(lv_obj_t * obj, lv_point_t points[], size_t count, lv_obj_point_transform_flag_t flags) {
    lv_obj_transform_point_array(obj,points,count,flags);
}

/*
Transform an area using the angle and zoom style properties of an object 
*/
void stub_lv_obj_get_transformed_area(lv_obj_t * obj, lv_area_t * area, lv_obj_point_transform_flag_t flags) {
    lv_obj_get_transformed_area(obj,area,flags);
}

/*
Mark an area of an object as invalid. The area will be truncated to the object's area and marked for redraw. 
*/
void stub_lv_obj_invalidate_area(lv_obj_t * obj, lv_area_t * area) {
    lv_obj_invalidate_area(obj,area);
}

/*
Mark the object as invalid to redrawn its area 
*/
void stub_lv_obj_invalidate(lv_obj_t * obj) {
    lv_obj_invalidate(obj);
}

/*
Tell whether an area of an object is visible (even partially) now or not true visible; false not visible (hidden, out of parent, on other screen, etc) 
*/
bool stub_lv_obj_area_is_visible(lv_obj_t * obj, lv_area_t * area) {
    return lv_obj_area_is_visible(obj,area);
}

/*
Tell whether an object is visible (even partially) now or not true: visible; false not visible (hidden, out of parent, on other screen, etc) 
*/
bool stub_lv_obj_is_visible(lv_obj_t * obj) {
    return lv_obj_is_visible(obj);
}

/*
Set the size of an extended clickable area 
*/
void stub_lv_obj_set_ext_click_area(lv_obj_t * obj, int32_t size) {
    lv_obj_set_ext_click_area(obj,size);
}

/*
Get the an area where to object can be clicked. It's the object's normal area plus the extended click area. 
*/
void stub_lv_obj_get_click_area(lv_obj_t * obj, lv_area_t * area) {
    lv_obj_get_click_area(obj,area);
}

/*
Hit-test an object given a particular point in screen space. true: if the object is considered under the point 
*/
bool stub_lv_obj_hit_test(lv_obj_t * obj, lv_point_t * point) {
    return lv_obj_hit_test(obj,point);
}

/*
Clamp a width between min and max width. If the min/max width is in percentage value use the ref_width the clamped width 
*/
int32_t stub_lv_clamp_width(int32_t width, int32_t min_width, int32_t max_width, int32_t ref_width) {
    return lv_clamp_width(width,min_width,max_width,ref_width);
}

/*
Clamp a height between min and max height. If the min/max height is in percentage value use the ref_height the clamped height 
*/
int32_t stub_lv_clamp_height(int32_t height, int32_t min_height, int32_t max_height, int32_t ref_height) {
    return lv_clamp_height(height,min_height,max_height,ref_height);
}

/*
Set how the scrollbars should behave. 
*/
void stub_lv_obj_set_scrollbar_mode(lv_obj_t * obj, lv_scrollbar_mode_t mode) {
    lv_obj_set_scrollbar_mode(obj,mode);
}

/*
Set the object in which directions can be scrolled 
*/
void stub_lv_obj_set_scroll_dir(lv_obj_t * obj, lv_dir_t dir) {
    lv_obj_set_scroll_dir(obj,dir);
}

/*
Set where to snap the children when scrolling ends horizontally 
*/
void stub_lv_obj_set_scroll_snap_x(lv_obj_t * obj, lv_scroll_snap_t align) {
    lv_obj_set_scroll_snap_x(obj,align);
}

/*
Set where to snap the children when scrolling ends vertically 
*/
void stub_lv_obj_set_scroll_snap_y(lv_obj_t * obj, lv_scroll_snap_t align) {
    lv_obj_set_scroll_snap_y(obj,align);
}

/*
Get the current scroll mode (when to hide the scrollbars) the current scroll mode from lv_scrollbar_mode_t 
*/
lv_scrollbar_mode_t stub_lv_obj_get_scrollbar_mode(lv_obj_t * obj) {
    return lv_obj_get_scrollbar_mode(obj);
}

/*
Get the object in which directions can be scrolled 
*/
lv_dir_t stub_lv_obj_get_scroll_dir(lv_obj_t * obj) {
    return lv_obj_get_scroll_dir(obj);
}

/*
Get where to snap the children when scrolling ends horizontally the current snap align from lv_scroll_snap_t 
*/
lv_scroll_snap_t stub_lv_obj_get_scroll_snap_x(lv_obj_t * obj) {
    return lv_obj_get_scroll_snap_x(obj);
}

/*
Get where to snap the children when scrolling ends vertically the current snap align from lv_scroll_snap_t 
*/
lv_scroll_snap_t stub_lv_obj_get_scroll_snap_y(lv_obj_t * obj) {
    return lv_obj_get_scroll_snap_y(obj);
}

/*
Get current X scroll position. the current scroll position from the left edge. If the object is not scrolled return 0 If scrolled return > 0 If scrolled in (elastic scroll) return < 0 
*/
int32_t stub_lv_obj_get_scroll_x(lv_obj_t * obj) {
    return lv_obj_get_scroll_x(obj);
}

/*
Get current Y scroll position. the current scroll position from the top edge. If the object is not scrolled return 0 If scrolled return > 0 If scrolled inside return < 0 
*/
int32_t stub_lv_obj_get_scroll_y(lv_obj_t * obj) {
    return lv_obj_get_scroll_y(obj);
}

/*
Return the height of the area above the object. That is the number of pixels the object can be scrolled down. Normally positive but can be negative when scrolled inside. the scrollable area above the object in pixels 
*/
int32_t stub_lv_obj_get_scroll_top(lv_obj_t * obj) {
    return lv_obj_get_scroll_top(obj);
}

/*
Return the height of the area below the object. That is the number of pixels the object can be scrolled down. Normally positive but can be negative when scrolled inside. the scrollable area below the object in pixels 
*/
int32_t stub_lv_obj_get_scroll_bottom(lv_obj_t * obj) {
    return lv_obj_get_scroll_bottom(obj);
}

/*
Return the width of the area on the left the object. That is the number of pixels the object can be scrolled down. Normally positive but can be negative when scrolled inside. the scrollable area on the left the object in pixels 
*/
int32_t stub_lv_obj_get_scroll_left(lv_obj_t * obj) {
    return lv_obj_get_scroll_left(obj);
}

/*
Return the width of the area on the right the object. That is the number of pixels the object can be scrolled down. Normally positive but can be negative when scrolled inside. the scrollable area on the right the object in pixels 
*/
int32_t stub_lv_obj_get_scroll_right(lv_obj_t * obj) {
    return lv_obj_get_scroll_right(obj);
}

/*
Get the X and Y coordinates where the scrolling will end for this object if a scrolling animation is in progress. If no scrolling animation, give the current x or y scroll position. 
*/
void stub_lv_obj_get_scroll_end(lv_obj_t * obj, lv_point_t * end) {
    lv_obj_get_scroll_end(obj,end);
}

/*
Scroll by a given amount of pixels > 0 value means scroll right/bottom (show the more content on the right/bottom)  e.g. dy = -20 means scroll down 20 px 
*/
void stub_lv_obj_scroll_by(lv_obj_t * obj, int32_t x, int32_t y, lv_anim_enable_t anim_en) {
    lv_obj_scroll_by(obj,x,y,anim_en);
}

/*
Scroll by a given amount of pixels. dx and dy will be limited internally to allow scrolling only on the content area. e.g. dy = -20 means scroll down 20 px 
*/
void stub_lv_obj_scroll_by_bounded(lv_obj_t * obj, int32_t dx, int32_t dy, lv_anim_enable_t anim_en) {
    lv_obj_scroll_by_bounded(obj,dx,dy,anim_en);
}

/*
Scroll to a given coordinate on an object. x and y will be limited internally to allow scrolling only on the content area. 
*/
void stub_lv_obj_scroll_to(lv_obj_t * obj, int32_t x, int32_t y, lv_anim_enable_t anim_en) {
    lv_obj_scroll_to(obj,x,y,anim_en);
}

/*
Scroll to a given X coordinate on an object. x will be limited internally to allow scrolling only on the content area. 
*/
void stub_lv_obj_scroll_to_x(lv_obj_t * obj, int32_t x, lv_anim_enable_t anim_en) {
    lv_obj_scroll_to_x(obj,x,anim_en);
}

/*
Scroll to a given Y coordinate on an object y will be limited internally to allow scrolling only on the content area. 
*/
void stub_lv_obj_scroll_to_y(lv_obj_t * obj, int32_t y, lv_anim_enable_t anim_en) {
    lv_obj_scroll_to_y(obj,y,anim_en);
}

/*
Scroll to an object until it becomes visible on its parent 
*/
void stub_lv_obj_scroll_to_view(lv_obj_t * obj, lv_anim_enable_t anim_en) {
    lv_obj_scroll_to_view(obj,anim_en);
}

/*
Scroll to an object until it becomes visible on its parent. Do the same on the parent's parent, and so on. Therefore the object will be scrolled into view even it has nested scrollable parents 
*/
void stub_lv_obj_scroll_to_view_recursive(lv_obj_t * obj, lv_anim_enable_t anim_en) {
    lv_obj_scroll_to_view_recursive(obj,anim_en);
}

/*
Tell whether an object is being scrolled or not at this moment true: obj is being scrolled 
*/
bool stub_lv_obj_is_scrolling(lv_obj_t * obj) {
    return lv_obj_is_scrolling(obj);
}

/*
Check the children of obj and scroll obj to fulfill the scroll_snap settings 
*/
void stub_lv_obj_update_snap(lv_obj_t * obj, lv_anim_enable_t anim_en) {
    lv_obj_update_snap(obj,anim_en);
}

/*
Get the area of the scrollbars 
*/
void stub_lv_obj_get_scrollbar_area(lv_obj_t * obj, lv_area_t * hor, lv_area_t * ver) {
    lv_obj_get_scrollbar_area(obj,hor,ver);
}

/*
Invalidate the area of the scrollbars 
*/
void stub_lv_obj_scrollbar_invalidate(lv_obj_t * obj) {
    lv_obj_scrollbar_invalidate(obj);
}

/*
Checks if the content is scrolled "in" and adjusts it to a normal position. 
*/
void stub_lv_obj_readjust_scroll(lv_obj_t * obj, lv_anim_enable_t anim_en) {
    lv_obj_readjust_scroll(obj,anim_en);
}

/*
Add a style to an object. lv_obj_add_style(btn, &style_btn, 0); //Default button style lv_obj_add_style(btn, &btn_red, LV_STATE_PRESSED); //Overwrite only some colors to red when pressed 
*/
void stub_lv_obj_add_style(lv_obj_t * obj, lv_style_t * style, lv_style_selector_t selector) {
    lv_obj_add_style(obj,style,selector);
}

/*
Replaces a style of an object, preserving the order of the style stack (local styles and transitions are ignored). lv_obj_replace_style(obj, &yellow_style, &blue_style, LV_PART_ANY | LV_STATE_ANY); //Replace a specific style lv_obj_replace_style(obj, &yellow_style, &blue_style, LV_PART_MAIN | LV_STATE_PRESSED); //Replace a specific style assigned to the main part when it is pressed 
*/
bool stub_lv_obj_replace_style(lv_obj_t * obj, lv_style_t * old_style, lv_style_t * new_style, lv_style_selector_t selector) {
    return lv_obj_replace_style(obj,old_style,new_style,selector);
}

/*
Remove a style from an object. lv_obj_remove_style(obj, &style, LV_PART_ANY | LV_STATE_ANY); //Remove a specific style lv_obj_remove_style(obj, NULL, LV_PART_MAIN | LV_STATE_ANY); //Remove all styles from the main part  lv_obj_remove_style(obj, NULL, LV_PART_ANY | LV_STATE_ANY); //Remove all styles 
*/
void stub_lv_obj_remove_style(lv_obj_t * obj, lv_style_t * style, lv_style_selector_t selector) {
    lv_obj_remove_style(obj,style,selector);
}

/*
Remove all styles from an object 
*/
void stub_lv_obj_remove_style_all(lv_obj_t * obj) {
    lv_obj_remove_style_all(obj);
}

/*
Notify all object if a style is modified 
*/
void stub_lv_obj_report_style_change(lv_style_t * style) {
    lv_obj_report_style_change(style);
}

/*
Notify an object and its children about its style is modified. 
*/
void stub_lv_obj_refresh_style(lv_obj_t * obj, lv_part_t part, lv_style_prop_t prop) {
    lv_obj_refresh_style(obj,part,prop);
}

/*
Enable or disable automatic style refreshing when a new style is added/removed to/from an object or any other style change happens. 
*/
void stub_lv_obj_enable_style_refresh(bool en) {
    lv_obj_enable_style_refresh(en);
}

/*
Get the value of a style property. The current state of the object will be considered. Inherited properties will be inherited. If a property is not set a default value will be returned. the value of the property. Should be read from the correct field of the :ref:`lv_style_value_t` according to the type of the property. 
*/
lv_style_value_t stub_lv_obj_get_style_prop(lv_obj_t * obj, lv_part_t part, lv_style_prop_t prop) {
    return lv_obj_get_style_prop(obj,part,prop);
}

/*
Check if an object has a specified style property for a given style selector. true if the object has the specified selector and property, false otherwise. 
*/
bool stub_lv_obj_has_style_prop(lv_obj_t * obj, lv_style_selector_t selector, lv_style_prop_t prop) {
    return lv_obj_has_style_prop(obj,selector,prop);
}

/*
Set local style property on an object's part and state. 
*/
void stub_lv_obj_set_local_style_prop(lv_obj_t * obj, lv_style_prop_t prop, lv_style_value_t value, lv_style_selector_t selector) {
    lv_obj_set_local_style_prop(obj,prop,value,selector);
}

lv_style_res_t stub_lv_obj_get_local_style_prop(lv_obj_t * obj, lv_style_prop_t prop, lv_style_value_t * value, lv_style_selector_t selector) {
    return lv_obj_get_local_style_prop(obj,prop,value,selector);
}

/*
Remove a local style property from a part of an object with a given state. true the property was found and removed; false: the property was not found 
*/
bool stub_lv_obj_remove_local_style_prop(lv_obj_t * obj, lv_style_prop_t prop, lv_style_selector_t selector) {
    return lv_obj_remove_local_style_prop(obj,prop,selector);
}

/*
Used internally for color filtering 
*/
lv_style_value_t stub_lv_obj_style_apply_color_filter(lv_obj_t * obj, lv_part_t part, lv_style_value_t v) {
    return lv_obj_style_apply_color_filter(obj,part,v);
}

/*
Fade in an an object and all its children. 
*/
void stub_lv_obj_fade_in(lv_obj_t * obj, uint32_t time, uint32_t delay) {
    lv_obj_fade_in(obj,time,delay);
}

/*
Fade out an an object and all its children. 
*/
void stub_lv_obj_fade_out(lv_obj_t * obj, uint32_t time, uint32_t delay) {
    lv_obj_fade_out(obj,time,delay);
}

lv_state_t stub_lv_obj_style_get_selector_state(lv_style_selector_t selector) {
    return lv_obj_style_get_selector_state(selector);
}

lv_part_t stub_lv_obj_style_get_selector_part(lv_style_selector_t selector) {
    return lv_obj_style_get_selector_part(selector);
}

int32_t stub_lv_obj_get_style_width(lv_obj_t * obj, lv_part_t part) {
    return lv_obj_get_style_width(obj,part);
}

int32_t stub_lv_obj_get_style_min_width(lv_obj_t * obj, lv_part_t part) {
    return lv_obj_get_style_min_width(obj,part);
}

int32_t stub_lv_obj_get_style_max_width(lv_obj_t * obj, lv_part_t part) {
    return lv_obj_get_style_max_width(obj,part);
}

int32_t stub_lv_obj_get_style_height(lv_obj_t * obj, lv_part_t part) {
    return lv_obj_get_style_height(obj,part);
}

int32_t stub_lv_obj_get_style_min_height(lv_obj_t * obj, lv_part_t part) {
    return lv_obj_get_style_min_height(obj,part);
}

int32_t stub_lv_obj_get_style_max_height(lv_obj_t * obj, lv_part_t part) {
    return lv_obj_get_style_max_height(obj,part);
}

int32_t stub_lv_obj_get_style_length(lv_obj_t * obj, lv_part_t part) {
    return lv_obj_get_style_length(obj,part);
}

int32_t stub_lv_obj_get_style_x(lv_obj_t * obj, lv_part_t part) {
    return lv_obj_get_style_x(obj,part);
}

int32_t stub_lv_obj_get_style_y(lv_obj_t * obj, lv_part_t part) {
    return lv_obj_get_style_y(obj,part);
}

lv_align_t stub_lv_obj_get_style_align(lv_obj_t * obj, lv_part_t part) {
    return lv_obj_get_style_align(obj,part);
}

int32_t stub_lv_obj_get_style_transform_width(lv_obj_t * obj, lv_part_t part) {
    return lv_obj_get_style_transform_width(obj,part);
}

int32_t stub_lv_obj_get_style_transform_height(lv_obj_t * obj, lv_part_t part) {
    return lv_obj_get_style_transform_height(obj,part);
}

int32_t stub_lv_obj_get_style_translate_x(lv_obj_t * obj, lv_part_t part) {
    return lv_obj_get_style_translate_x(obj,part);
}

int32_t stub_lv_obj_get_style_translate_y(lv_obj_t * obj, lv_part_t part) {
    return lv_obj_get_style_translate_y(obj,part);
}

int32_t stub_lv_obj_get_style_transform_scale_x(lv_obj_t * obj, lv_part_t part) {
    return lv_obj_get_style_transform_scale_x(obj,part);
}

int32_t stub_lv_obj_get_style_transform_scale_y(lv_obj_t * obj, lv_part_t part) {
    return lv_obj_get_style_transform_scale_y(obj,part);
}

int32_t stub_lv_obj_get_style_transform_rotation(lv_obj_t * obj, lv_part_t part) {
    return lv_obj_get_style_transform_rotation(obj,part);
}

int32_t stub_lv_obj_get_style_transform_pivot_x(lv_obj_t * obj, lv_part_t part) {
    return lv_obj_get_style_transform_pivot_x(obj,part);
}

int32_t stub_lv_obj_get_style_transform_pivot_y(lv_obj_t * obj, lv_part_t part) {
    return lv_obj_get_style_transform_pivot_y(obj,part);
}

int32_t stub_lv_obj_get_style_transform_skew_x(lv_obj_t * obj, lv_part_t part) {
    return lv_obj_get_style_transform_skew_x(obj,part);
}

int32_t stub_lv_obj_get_style_transform_skew_y(lv_obj_t * obj, lv_part_t part) {
    return lv_obj_get_style_transform_skew_y(obj,part);
}

int32_t stub_lv_obj_get_style_pad_top(lv_obj_t * obj, lv_part_t part) {
    return lv_obj_get_style_pad_top(obj,part);
}

int32_t stub_lv_obj_get_style_pad_bottom(lv_obj_t * obj, lv_part_t part) {
    return lv_obj_get_style_pad_bottom(obj,part);
}

int32_t stub_lv_obj_get_style_pad_left(lv_obj_t * obj, lv_part_t part) {
    return lv_obj_get_style_pad_left(obj,part);
}

int32_t stub_lv_obj_get_style_pad_right(lv_obj_t * obj, lv_part_t part) {
    return lv_obj_get_style_pad_right(obj,part);
}

int32_t stub_lv_obj_get_style_pad_row(lv_obj_t * obj, lv_part_t part) {
    return lv_obj_get_style_pad_row(obj,part);
}

int32_t stub_lv_obj_get_style_pad_column(lv_obj_t * obj, lv_part_t part) {
    return lv_obj_get_style_pad_column(obj,part);
}

int32_t stub_lv_obj_get_style_margin_top(lv_obj_t * obj, lv_part_t part) {
    return lv_obj_get_style_margin_top(obj,part);
}

int32_t stub_lv_obj_get_style_margin_bottom(lv_obj_t * obj, lv_part_t part) {
    return lv_obj_get_style_margin_bottom(obj,part);
}

int32_t stub_lv_obj_get_style_margin_left(lv_obj_t * obj, lv_part_t part) {
    return lv_obj_get_style_margin_left(obj,part);
}

int32_t stub_lv_obj_get_style_margin_right(lv_obj_t * obj, lv_part_t part) {
    return lv_obj_get_style_margin_right(obj,part);
}

lv_color_t stub_lv_obj_get_style_bg_color(lv_obj_t * obj, lv_part_t part) {
    return lv_obj_get_style_bg_color(obj,part);
}

lv_color_t stub_lv_obj_get_style_bg_color_filtered(lv_obj_t * obj, lv_part_t part) {
    return lv_obj_get_style_bg_color_filtered(obj,part);
}

lv_opa_t stub_lv_obj_get_style_bg_opa(lv_obj_t * obj, lv_part_t part) {
    return lv_obj_get_style_bg_opa(obj,part);
}

lv_color_t stub_lv_obj_get_style_bg_grad_color(lv_obj_t * obj, lv_part_t part) {
    return lv_obj_get_style_bg_grad_color(obj,part);
}

lv_color_t stub_lv_obj_get_style_bg_grad_color_filtered(lv_obj_t * obj, lv_part_t part) {
    return lv_obj_get_style_bg_grad_color_filtered(obj,part);
}

lv_grad_dir_t stub_lv_obj_get_style_bg_grad_dir(lv_obj_t * obj, lv_part_t part) {
    return lv_obj_get_style_bg_grad_dir(obj,part);
}

int32_t stub_lv_obj_get_style_bg_main_stop(lv_obj_t * obj, lv_part_t part) {
    return lv_obj_get_style_bg_main_stop(obj,part);
}

int32_t stub_lv_obj_get_style_bg_grad_stop(lv_obj_t * obj, lv_part_t part) {
    return lv_obj_get_style_bg_grad_stop(obj,part);
}

lv_opa_t stub_lv_obj_get_style_bg_main_opa(lv_obj_t * obj, lv_part_t part) {
    return lv_obj_get_style_bg_main_opa(obj,part);
}

lv_opa_t stub_lv_obj_get_style_bg_grad_opa(lv_obj_t * obj, lv_part_t part) {
    return lv_obj_get_style_bg_grad_opa(obj,part);
}

lv_grad_dsc_t * stub_lv_obj_get_style_bg_grad(lv_obj_t * obj, lv_part_t part) {
    return lv_obj_get_style_bg_grad(obj,part);
}

void * stub_lv_obj_get_style_bg_image_src(lv_obj_t * obj, lv_part_t part) {
    return lv_obj_get_style_bg_image_src(obj,part);
}

lv_opa_t stub_lv_obj_get_style_bg_image_opa(lv_obj_t * obj, lv_part_t part) {
    return lv_obj_get_style_bg_image_opa(obj,part);
}

lv_color_t stub_lv_obj_get_style_bg_image_recolor(lv_obj_t * obj, lv_part_t part) {
    return lv_obj_get_style_bg_image_recolor(obj,part);
}

lv_color_t stub_lv_obj_get_style_bg_image_recolor_filtered(lv_obj_t * obj, lv_part_t part) {
    return lv_obj_get_style_bg_image_recolor_filtered(obj,part);
}

lv_opa_t stub_lv_obj_get_style_bg_image_recolor_opa(lv_obj_t * obj, lv_part_t part) {
    return lv_obj_get_style_bg_image_recolor_opa(obj,part);
}

bool stub_lv_obj_get_style_bg_image_tiled(lv_obj_t * obj, lv_part_t part) {
    return lv_obj_get_style_bg_image_tiled(obj,part);
}

lv_color_t stub_lv_obj_get_style_border_color(lv_obj_t * obj, lv_part_t part) {
    return lv_obj_get_style_border_color(obj,part);
}

lv_color_t stub_lv_obj_get_style_border_color_filtered(lv_obj_t * obj, lv_part_t part) {
    return lv_obj_get_style_border_color_filtered(obj,part);
}

lv_opa_t stub_lv_obj_get_style_border_opa(lv_obj_t * obj, lv_part_t part) {
    return lv_obj_get_style_border_opa(obj,part);
}

int32_t stub_lv_obj_get_style_border_width(lv_obj_t * obj, lv_part_t part) {
    return lv_obj_get_style_border_width(obj,part);
}

lv_border_side_t stub_lv_obj_get_style_border_side(lv_obj_t * obj, lv_part_t part) {
    return lv_obj_get_style_border_side(obj,part);
}

bool stub_lv_obj_get_style_border_post(lv_obj_t * obj, lv_part_t part) {
    return lv_obj_get_style_border_post(obj,part);
}

int32_t stub_lv_obj_get_style_outline_width(lv_obj_t * obj, lv_part_t part) {
    return lv_obj_get_style_outline_width(obj,part);
}

lv_color_t stub_lv_obj_get_style_outline_color(lv_obj_t * obj, lv_part_t part) {
    return lv_obj_get_style_outline_color(obj,part);
}

lv_color_t stub_lv_obj_get_style_outline_color_filtered(lv_obj_t * obj, lv_part_t part) {
    return lv_obj_get_style_outline_color_filtered(obj,part);
}

lv_opa_t stub_lv_obj_get_style_outline_opa(lv_obj_t * obj, lv_part_t part) {
    return lv_obj_get_style_outline_opa(obj,part);
}

int32_t stub_lv_obj_get_style_outline_pad(lv_obj_t * obj, lv_part_t part) {
    return lv_obj_get_style_outline_pad(obj,part);
}

int32_t stub_lv_obj_get_style_shadow_width(lv_obj_t * obj, lv_part_t part) {
    return lv_obj_get_style_shadow_width(obj,part);
}

int32_t stub_lv_obj_get_style_shadow_offset_x(lv_obj_t * obj, lv_part_t part) {
    return lv_obj_get_style_shadow_offset_x(obj,part);
}

int32_t stub_lv_obj_get_style_shadow_offset_y(lv_obj_t * obj, lv_part_t part) {
    return lv_obj_get_style_shadow_offset_y(obj,part);
}

int32_t stub_lv_obj_get_style_shadow_spread(lv_obj_t * obj, lv_part_t part) {
    return lv_obj_get_style_shadow_spread(obj,part);
}

lv_color_t stub_lv_obj_get_style_shadow_color(lv_obj_t * obj, lv_part_t part) {
    return lv_obj_get_style_shadow_color(obj,part);
}

lv_color_t stub_lv_obj_get_style_shadow_color_filtered(lv_obj_t * obj, lv_part_t part) {
    return lv_obj_get_style_shadow_color_filtered(obj,part);
}

lv_opa_t stub_lv_obj_get_style_shadow_opa(lv_obj_t * obj, lv_part_t part) {
    return lv_obj_get_style_shadow_opa(obj,part);
}

lv_opa_t stub_lv_obj_get_style_image_opa(lv_obj_t * obj, lv_part_t part) {
    return lv_obj_get_style_image_opa(obj,part);
}

lv_color_t stub_lv_obj_get_style_image_recolor(lv_obj_t * obj, lv_part_t part) {
    return lv_obj_get_style_image_recolor(obj,part);
}

lv_color_t stub_lv_obj_get_style_image_recolor_filtered(lv_obj_t * obj, lv_part_t part) {
    return lv_obj_get_style_image_recolor_filtered(obj,part);
}

lv_opa_t stub_lv_obj_get_style_image_recolor_opa(lv_obj_t * obj, lv_part_t part) {
    return lv_obj_get_style_image_recolor_opa(obj,part);
}

int32_t stub_lv_obj_get_style_line_width(lv_obj_t * obj, lv_part_t part) {
    return lv_obj_get_style_line_width(obj,part);
}

int32_t stub_lv_obj_get_style_line_dash_width(lv_obj_t * obj, lv_part_t part) {
    return lv_obj_get_style_line_dash_width(obj,part);
}

int32_t stub_lv_obj_get_style_line_dash_gap(lv_obj_t * obj, lv_part_t part) {
    return lv_obj_get_style_line_dash_gap(obj,part);
}

bool stub_lv_obj_get_style_line_rounded(lv_obj_t * obj, lv_part_t part) {
    return lv_obj_get_style_line_rounded(obj,part);
}

lv_color_t stub_lv_obj_get_style_line_color(lv_obj_t * obj, lv_part_t part) {
    return lv_obj_get_style_line_color(obj,part);
}

lv_color_t stub_lv_obj_get_style_line_color_filtered(lv_obj_t * obj, lv_part_t part) {
    return lv_obj_get_style_line_color_filtered(obj,part);
}

lv_opa_t stub_lv_obj_get_style_line_opa(lv_obj_t * obj, lv_part_t part) {
    return lv_obj_get_style_line_opa(obj,part);
}

int32_t stub_lv_obj_get_style_arc_width(lv_obj_t * obj, lv_part_t part) {
    return lv_obj_get_style_arc_width(obj,part);
}

bool stub_lv_obj_get_style_arc_rounded(lv_obj_t * obj, lv_part_t part) {
    return lv_obj_get_style_arc_rounded(obj,part);
}

lv_color_t stub_lv_obj_get_style_arc_color(lv_obj_t * obj, lv_part_t part) {
    return lv_obj_get_style_arc_color(obj,part);
}

lv_color_t stub_lv_obj_get_style_arc_color_filtered(lv_obj_t * obj, lv_part_t part) {
    return lv_obj_get_style_arc_color_filtered(obj,part);
}

lv_opa_t stub_lv_obj_get_style_arc_opa(lv_obj_t * obj, lv_part_t part) {
    return lv_obj_get_style_arc_opa(obj,part);
}

void * stub_lv_obj_get_style_arc_image_src(lv_obj_t * obj, lv_part_t part) {
    return lv_obj_get_style_arc_image_src(obj,part);
}

lv_color_t stub_lv_obj_get_style_text_color(lv_obj_t * obj, lv_part_t part) {
    return lv_obj_get_style_text_color(obj,part);
}

lv_color_t stub_lv_obj_get_style_text_color_filtered(lv_obj_t * obj, lv_part_t part) {
    return lv_obj_get_style_text_color_filtered(obj,part);
}

lv_opa_t stub_lv_obj_get_style_text_opa(lv_obj_t * obj, lv_part_t part) {
    return lv_obj_get_style_text_opa(obj,part);
}

lv_font_t * stub_lv_obj_get_style_text_font(lv_obj_t * obj, lv_part_t part) {
    return lv_obj_get_style_text_font(obj,part);
}

int32_t stub_lv_obj_get_style_text_letter_space(lv_obj_t * obj, lv_part_t part) {
    return lv_obj_get_style_text_letter_space(obj,part);
}

int32_t stub_lv_obj_get_style_text_line_space(lv_obj_t * obj, lv_part_t part) {
    return lv_obj_get_style_text_line_space(obj,part);
}

lv_text_decor_t stub_lv_obj_get_style_text_decor(lv_obj_t * obj, lv_part_t part) {
    return lv_obj_get_style_text_decor(obj,part);
}

lv_text_align_t stub_lv_obj_get_style_text_align(lv_obj_t * obj, lv_part_t part) {
    return lv_obj_get_style_text_align(obj,part);
}

int32_t stub_lv_obj_get_style_radius(lv_obj_t * obj, lv_part_t part) {
    return lv_obj_get_style_radius(obj,part);
}

bool stub_lv_obj_get_style_clip_corner(lv_obj_t * obj, lv_part_t part) {
    return lv_obj_get_style_clip_corner(obj,part);
}

lv_opa_t stub_lv_obj_get_style_opa(lv_obj_t * obj, lv_part_t part) {
    return lv_obj_get_style_opa(obj,part);
}

lv_opa_t stub_lv_obj_get_style_opa_layered(lv_obj_t * obj, lv_part_t part) {
    return lv_obj_get_style_opa_layered(obj,part);
}

lv_color_filter_dsc_t * stub_lv_obj_get_style_color_filter_dsc(lv_obj_t * obj, lv_part_t part) {
    return lv_obj_get_style_color_filter_dsc(obj,part);
}

lv_opa_t stub_lv_obj_get_style_color_filter_opa(lv_obj_t * obj, lv_part_t part) {
    return lv_obj_get_style_color_filter_opa(obj,part);
}

lv_anim_t * stub_lv_obj_get_style_anim(lv_obj_t * obj, lv_part_t part) {
    return lv_obj_get_style_anim(obj,part);
}

uint32_t stub_lv_obj_get_style_anim_duration(lv_obj_t * obj, lv_part_t part) {
    return lv_obj_get_style_anim_duration(obj,part);
}

lv_style_transition_dsc_t * stub_lv_obj_get_style_transition(lv_obj_t * obj, lv_part_t part) {
    return lv_obj_get_style_transition(obj,part);
}

lv_blend_mode_t stub_lv_obj_get_style_blend_mode(lv_obj_t * obj, lv_part_t part) {
    return lv_obj_get_style_blend_mode(obj,part);
}

uint16_t stub_lv_obj_get_style_layout(lv_obj_t * obj, lv_part_t part) {
    return lv_obj_get_style_layout(obj,part);
}

lv_base_dir_t stub_lv_obj_get_style_base_dir(lv_obj_t * obj, lv_part_t part) {
    return lv_obj_get_style_base_dir(obj,part);
}

void * stub_lv_obj_get_style_bitmap_mask_src(lv_obj_t * obj, lv_part_t part) {
    return lv_obj_get_style_bitmap_mask_src(obj,part);
}

uint32_t stub_lv_obj_get_style_rotary_sensitivity(lv_obj_t * obj, lv_part_t part) {
    return lv_obj_get_style_rotary_sensitivity(obj,part);
}

lv_flex_flow_t stub_lv_obj_get_style_flex_flow(lv_obj_t * obj, lv_part_t part) {
    return lv_obj_get_style_flex_flow(obj,part);
}

lv_flex_align_t stub_lv_obj_get_style_flex_main_place(lv_obj_t * obj, lv_part_t part) {
    return lv_obj_get_style_flex_main_place(obj,part);
}

lv_flex_align_t stub_lv_obj_get_style_flex_cross_place(lv_obj_t * obj, lv_part_t part) {
    return lv_obj_get_style_flex_cross_place(obj,part);
}

lv_flex_align_t stub_lv_obj_get_style_flex_track_place(lv_obj_t * obj, lv_part_t part) {
    return lv_obj_get_style_flex_track_place(obj,part);
}

uint8_t stub_lv_obj_get_style_flex_grow(lv_obj_t * obj, lv_part_t part) {
    return lv_obj_get_style_flex_grow(obj,part);
}

int32_t * stub_lv_obj_get_style_grid_column_dsc_array(lv_obj_t * obj, lv_part_t part) {
    return lv_obj_get_style_grid_column_dsc_array(obj,part);
}

lv_grid_align_t stub_lv_obj_get_style_grid_column_align(lv_obj_t * obj, lv_part_t part) {
    return lv_obj_get_style_grid_column_align(obj,part);
}

int32_t * stub_lv_obj_get_style_grid_row_dsc_array(lv_obj_t * obj, lv_part_t part) {
    return lv_obj_get_style_grid_row_dsc_array(obj,part);
}

lv_grid_align_t stub_lv_obj_get_style_grid_row_align(lv_obj_t * obj, lv_part_t part) {
    return lv_obj_get_style_grid_row_align(obj,part);
}

int32_t stub_lv_obj_get_style_grid_cell_column_pos(lv_obj_t * obj, lv_part_t part) {
    return lv_obj_get_style_grid_cell_column_pos(obj,part);
}

lv_grid_align_t stub_lv_obj_get_style_grid_cell_x_align(lv_obj_t * obj, lv_part_t part) {
    return lv_obj_get_style_grid_cell_x_align(obj,part);
}

int32_t stub_lv_obj_get_style_grid_cell_column_span(lv_obj_t * obj, lv_part_t part) {
    return lv_obj_get_style_grid_cell_column_span(obj,part);
}

int32_t stub_lv_obj_get_style_grid_cell_row_pos(lv_obj_t * obj, lv_part_t part) {
    return lv_obj_get_style_grid_cell_row_pos(obj,part);
}

lv_grid_align_t stub_lv_obj_get_style_grid_cell_y_align(lv_obj_t * obj, lv_part_t part) {
    return lv_obj_get_style_grid_cell_y_align(obj,part);
}

int32_t stub_lv_obj_get_style_grid_cell_row_span(lv_obj_t * obj, lv_part_t part) {
    return lv_obj_get_style_grid_cell_row_span(obj,part);
}

void stub_lv_obj_set_style_width(lv_obj_t * obj, int32_t value, lv_style_selector_t selector) {
    lv_obj_set_style_width(obj,value,selector);
}

void stub_lv_obj_set_style_min_width(lv_obj_t * obj, int32_t value, lv_style_selector_t selector) {
    lv_obj_set_style_min_width(obj,value,selector);
}

void stub_lv_obj_set_style_max_width(lv_obj_t * obj, int32_t value, lv_style_selector_t selector) {
    lv_obj_set_style_max_width(obj,value,selector);
}

void stub_lv_obj_set_style_height(lv_obj_t * obj, int32_t value, lv_style_selector_t selector) {
    lv_obj_set_style_height(obj,value,selector);
}

void stub_lv_obj_set_style_min_height(lv_obj_t * obj, int32_t value, lv_style_selector_t selector) {
    lv_obj_set_style_min_height(obj,value,selector);
}

void stub_lv_obj_set_style_max_height(lv_obj_t * obj, int32_t value, lv_style_selector_t selector) {
    lv_obj_set_style_max_height(obj,value,selector);
}

void stub_lv_obj_set_style_length(lv_obj_t * obj, int32_t value, lv_style_selector_t selector) {
    lv_obj_set_style_length(obj,value,selector);
}

void stub_lv_obj_set_style_x(lv_obj_t * obj, int32_t value, lv_style_selector_t selector) {
    lv_obj_set_style_x(obj,value,selector);
}

void stub_lv_obj_set_style_y(lv_obj_t * obj, int32_t value, lv_style_selector_t selector) {
    lv_obj_set_style_y(obj,value,selector);
}

void stub_lv_obj_set_style_align(lv_obj_t * obj, lv_align_t value, lv_style_selector_t selector) {
    lv_obj_set_style_align(obj,value,selector);
}

void stub_lv_obj_set_style_transform_width(lv_obj_t * obj, int32_t value, lv_style_selector_t selector) {
    lv_obj_set_style_transform_width(obj,value,selector);
}

void stub_lv_obj_set_style_transform_height(lv_obj_t * obj, int32_t value, lv_style_selector_t selector) {
    lv_obj_set_style_transform_height(obj,value,selector);
}

void stub_lv_obj_set_style_translate_x(lv_obj_t * obj, int32_t value, lv_style_selector_t selector) {
    lv_obj_set_style_translate_x(obj,value,selector);
}

void stub_lv_obj_set_style_translate_y(lv_obj_t * obj, int32_t value, lv_style_selector_t selector) {
    lv_obj_set_style_translate_y(obj,value,selector);
}

void stub_lv_obj_set_style_transform_scale_x(lv_obj_t * obj, int32_t value, lv_style_selector_t selector) {
    lv_obj_set_style_transform_scale_x(obj,value,selector);
}

void stub_lv_obj_set_style_transform_scale_y(lv_obj_t * obj, int32_t value, lv_style_selector_t selector) {
    lv_obj_set_style_transform_scale_y(obj,value,selector);
}

void stub_lv_obj_set_style_transform_rotation(lv_obj_t * obj, int32_t value, lv_style_selector_t selector) {
    lv_obj_set_style_transform_rotation(obj,value,selector);
}

void stub_lv_obj_set_style_transform_pivot_x(lv_obj_t * obj, int32_t value, lv_style_selector_t selector) {
    lv_obj_set_style_transform_pivot_x(obj,value,selector);
}

void stub_lv_obj_set_style_transform_pivot_y(lv_obj_t * obj, int32_t value, lv_style_selector_t selector) {
    lv_obj_set_style_transform_pivot_y(obj,value,selector);
}

void stub_lv_obj_set_style_transform_skew_x(lv_obj_t * obj, int32_t value, lv_style_selector_t selector) {
    lv_obj_set_style_transform_skew_x(obj,value,selector);
}

void stub_lv_obj_set_style_transform_skew_y(lv_obj_t * obj, int32_t value, lv_style_selector_t selector) {
    lv_obj_set_style_transform_skew_y(obj,value,selector);
}

void stub_lv_obj_set_style_pad_top(lv_obj_t * obj, int32_t value, lv_style_selector_t selector) {
    lv_obj_set_style_pad_top(obj,value,selector);
}

void stub_lv_obj_set_style_pad_bottom(lv_obj_t * obj, int32_t value, lv_style_selector_t selector) {
    lv_obj_set_style_pad_bottom(obj,value,selector);
}

void stub_lv_obj_set_style_pad_left(lv_obj_t * obj, int32_t value, lv_style_selector_t selector) {
    lv_obj_set_style_pad_left(obj,value,selector);
}

void stub_lv_obj_set_style_pad_right(lv_obj_t * obj, int32_t value, lv_style_selector_t selector) {
    lv_obj_set_style_pad_right(obj,value,selector);
}

void stub_lv_obj_set_style_pad_row(lv_obj_t * obj, int32_t value, lv_style_selector_t selector) {
    lv_obj_set_style_pad_row(obj,value,selector);
}

void stub_lv_obj_set_style_pad_column(lv_obj_t * obj, int32_t value, lv_style_selector_t selector) {
    lv_obj_set_style_pad_column(obj,value,selector);
}

void stub_lv_obj_set_style_margin_top(lv_obj_t * obj, int32_t value, lv_style_selector_t selector) {
    lv_obj_set_style_margin_top(obj,value,selector);
}

void stub_lv_obj_set_style_margin_bottom(lv_obj_t * obj, int32_t value, lv_style_selector_t selector) {
    lv_obj_set_style_margin_bottom(obj,value,selector);
}

void stub_lv_obj_set_style_margin_left(lv_obj_t * obj, int32_t value, lv_style_selector_t selector) {
    lv_obj_set_style_margin_left(obj,value,selector);
}

void stub_lv_obj_set_style_margin_right(lv_obj_t * obj, int32_t value, lv_style_selector_t selector) {
    lv_obj_set_style_margin_right(obj,value,selector);
}

void stub_lv_obj_set_style_bg_color(lv_obj_t * obj, lv_color_t value, lv_style_selector_t selector) {
    lv_obj_set_style_bg_color(obj,value,selector);
}

void stub_lv_obj_set_style_bg_opa(lv_obj_t * obj, lv_opa_t value, lv_style_selector_t selector) {
    lv_obj_set_style_bg_opa(obj,value,selector);
}

void stub_lv_obj_set_style_bg_grad_color(lv_obj_t * obj, lv_color_t value, lv_style_selector_t selector) {
    lv_obj_set_style_bg_grad_color(obj,value,selector);
}

void stub_lv_obj_set_style_bg_grad_dir(lv_obj_t * obj, lv_grad_dir_t value, lv_style_selector_t selector) {
    lv_obj_set_style_bg_grad_dir(obj,value,selector);
}

void stub_lv_obj_set_style_bg_main_stop(lv_obj_t * obj, int32_t value, lv_style_selector_t selector) {
    lv_obj_set_style_bg_main_stop(obj,value,selector);
}

void stub_lv_obj_set_style_bg_grad_stop(lv_obj_t * obj, int32_t value, lv_style_selector_t selector) {
    lv_obj_set_style_bg_grad_stop(obj,value,selector);
}

void stub_lv_obj_set_style_bg_main_opa(lv_obj_t * obj, lv_opa_t value, lv_style_selector_t selector) {
    lv_obj_set_style_bg_main_opa(obj,value,selector);
}

void stub_lv_obj_set_style_bg_grad_opa(lv_obj_t * obj, lv_opa_t value, lv_style_selector_t selector) {
    lv_obj_set_style_bg_grad_opa(obj,value,selector);
}

void stub_lv_obj_set_style_bg_grad(lv_obj_t * obj, lv_grad_dsc_t * value, lv_style_selector_t selector) {
    lv_obj_set_style_bg_grad(obj,value,selector);
}

void stub_lv_obj_set_style_bg_image_src(lv_obj_t * obj, void * value, lv_style_selector_t selector) {
    lv_obj_set_style_bg_image_src(obj,value,selector);
}

void stub_lv_obj_set_style_bg_image_opa(lv_obj_t * obj, lv_opa_t value, lv_style_selector_t selector) {
    lv_obj_set_style_bg_image_opa(obj,value,selector);
}

void stub_lv_obj_set_style_bg_image_recolor(lv_obj_t * obj, lv_color_t value, lv_style_selector_t selector) {
    lv_obj_set_style_bg_image_recolor(obj,value,selector);
}

void stub_lv_obj_set_style_bg_image_recolor_opa(lv_obj_t * obj, lv_opa_t value, lv_style_selector_t selector) {
    lv_obj_set_style_bg_image_recolor_opa(obj,value,selector);
}

void stub_lv_obj_set_style_bg_image_tiled(lv_obj_t * obj, bool value, lv_style_selector_t selector) {
    lv_obj_set_style_bg_image_tiled(obj,value,selector);
}

void stub_lv_obj_set_style_border_color(lv_obj_t * obj, lv_color_t value, lv_style_selector_t selector) {
    lv_obj_set_style_border_color(obj,value,selector);
}

void stub_lv_obj_set_style_border_opa(lv_obj_t * obj, lv_opa_t value, lv_style_selector_t selector) {
    lv_obj_set_style_border_opa(obj,value,selector);
}

void stub_lv_obj_set_style_border_width(lv_obj_t * obj, int32_t value, lv_style_selector_t selector) {
    lv_obj_set_style_border_width(obj,value,selector);
}

void stub_lv_obj_set_style_border_side(lv_obj_t * obj, lv_border_side_t value, lv_style_selector_t selector) {
    lv_obj_set_style_border_side(obj,value,selector);
}

void stub_lv_obj_set_style_border_post(lv_obj_t * obj, bool value, lv_style_selector_t selector) {
    lv_obj_set_style_border_post(obj,value,selector);
}

void stub_lv_obj_set_style_outline_width(lv_obj_t * obj, int32_t value, lv_style_selector_t selector) {
    lv_obj_set_style_outline_width(obj,value,selector);
}

void stub_lv_obj_set_style_outline_color(lv_obj_t * obj, lv_color_t value, lv_style_selector_t selector) {
    lv_obj_set_style_outline_color(obj,value,selector);
}

void stub_lv_obj_set_style_outline_opa(lv_obj_t * obj, lv_opa_t value, lv_style_selector_t selector) {
    lv_obj_set_style_outline_opa(obj,value,selector);
}

void stub_lv_obj_set_style_outline_pad(lv_obj_t * obj, int32_t value, lv_style_selector_t selector) {
    lv_obj_set_style_outline_pad(obj,value,selector);
}

void stub_lv_obj_set_style_shadow_width(lv_obj_t * obj, int32_t value, lv_style_selector_t selector) {
    lv_obj_set_style_shadow_width(obj,value,selector);
}

void stub_lv_obj_set_style_shadow_offset_x(lv_obj_t * obj, int32_t value, lv_style_selector_t selector) {
    lv_obj_set_style_shadow_offset_x(obj,value,selector);
}

void stub_lv_obj_set_style_shadow_offset_y(lv_obj_t * obj, int32_t value, lv_style_selector_t selector) {
    lv_obj_set_style_shadow_offset_y(obj,value,selector);
}

void stub_lv_obj_set_style_shadow_spread(lv_obj_t * obj, int32_t value, lv_style_selector_t selector) {
    lv_obj_set_style_shadow_spread(obj,value,selector);
}

void stub_lv_obj_set_style_shadow_color(lv_obj_t * obj, lv_color_t value, lv_style_selector_t selector) {
    lv_obj_set_style_shadow_color(obj,value,selector);
}

void stub_lv_obj_set_style_shadow_opa(lv_obj_t * obj, lv_opa_t value, lv_style_selector_t selector) {
    lv_obj_set_style_shadow_opa(obj,value,selector);
}

void stub_lv_obj_set_style_image_opa(lv_obj_t * obj, lv_opa_t value, lv_style_selector_t selector) {
    lv_obj_set_style_image_opa(obj,value,selector);
}

void stub_lv_obj_set_style_image_recolor(lv_obj_t * obj, lv_color_t value, lv_style_selector_t selector) {
    lv_obj_set_style_image_recolor(obj,value,selector);
}

void stub_lv_obj_set_style_image_recolor_opa(lv_obj_t * obj, lv_opa_t value, lv_style_selector_t selector) {
    lv_obj_set_style_image_recolor_opa(obj,value,selector);
}

void stub_lv_obj_set_style_line_width(lv_obj_t * obj, int32_t value, lv_style_selector_t selector) {
    lv_obj_set_style_line_width(obj,value,selector);
}

void stub_lv_obj_set_style_line_dash_width(lv_obj_t * obj, int32_t value, lv_style_selector_t selector) {
    lv_obj_set_style_line_dash_width(obj,value,selector);
}

void stub_lv_obj_set_style_line_dash_gap(lv_obj_t * obj, int32_t value, lv_style_selector_t selector) {
    lv_obj_set_style_line_dash_gap(obj,value,selector);
}

void stub_lv_obj_set_style_line_rounded(lv_obj_t * obj, bool value, lv_style_selector_t selector) {
    lv_obj_set_style_line_rounded(obj,value,selector);
}

void stub_lv_obj_set_style_line_color(lv_obj_t * obj, lv_color_t value, lv_style_selector_t selector) {
    lv_obj_set_style_line_color(obj,value,selector);
}

void stub_lv_obj_set_style_line_opa(lv_obj_t * obj, lv_opa_t value, lv_style_selector_t selector) {
    lv_obj_set_style_line_opa(obj,value,selector);
}

void stub_lv_obj_set_style_arc_width(lv_obj_t * obj, int32_t value, lv_style_selector_t selector) {
    lv_obj_set_style_arc_width(obj,value,selector);
}

void stub_lv_obj_set_style_arc_rounded(lv_obj_t * obj, bool value, lv_style_selector_t selector) {
    lv_obj_set_style_arc_rounded(obj,value,selector);
}

void stub_lv_obj_set_style_arc_color(lv_obj_t * obj, lv_color_t value, lv_style_selector_t selector) {
    lv_obj_set_style_arc_color(obj,value,selector);
}

void stub_lv_obj_set_style_arc_opa(lv_obj_t * obj, lv_opa_t value, lv_style_selector_t selector) {
    lv_obj_set_style_arc_opa(obj,value,selector);
}

void stub_lv_obj_set_style_arc_image_src(lv_obj_t * obj, void * value, lv_style_selector_t selector) {
    lv_obj_set_style_arc_image_src(obj,value,selector);
}

void stub_lv_obj_set_style_text_color(lv_obj_t * obj, lv_color_t value, lv_style_selector_t selector) {
    lv_obj_set_style_text_color(obj,value,selector);
}

void stub_lv_obj_set_style_text_opa(lv_obj_t * obj, lv_opa_t value, lv_style_selector_t selector) {
    lv_obj_set_style_text_opa(obj,value,selector);
}

void stub_lv_obj_set_style_text_font(lv_obj_t * obj, lv_font_t * value, lv_style_selector_t selector) {
    lv_obj_set_style_text_font(obj,value,selector);
}

void stub_lv_obj_set_style_text_letter_space(lv_obj_t * obj, int32_t value, lv_style_selector_t selector) {
    lv_obj_set_style_text_letter_space(obj,value,selector);
}

void stub_lv_obj_set_style_text_line_space(lv_obj_t * obj, int32_t value, lv_style_selector_t selector) {
    lv_obj_set_style_text_line_space(obj,value,selector);
}

void stub_lv_obj_set_style_text_decor(lv_obj_t * obj, lv_text_decor_t value, lv_style_selector_t selector) {
    lv_obj_set_style_text_decor(obj,value,selector);
}

void stub_lv_obj_set_style_text_align(lv_obj_t * obj, lv_text_align_t value, lv_style_selector_t selector) {
    lv_obj_set_style_text_align(obj,value,selector);
}

void stub_lv_obj_set_style_radius(lv_obj_t * obj, int32_t value, lv_style_selector_t selector) {
    lv_obj_set_style_radius(obj,value,selector);
}

void stub_lv_obj_set_style_clip_corner(lv_obj_t * obj, bool value, lv_style_selector_t selector) {
    lv_obj_set_style_clip_corner(obj,value,selector);
}

void stub_lv_obj_set_style_opa(lv_obj_t * obj, lv_opa_t value, lv_style_selector_t selector) {
    lv_obj_set_style_opa(obj,value,selector);
}

void stub_lv_obj_set_style_opa_layered(lv_obj_t * obj, lv_opa_t value, lv_style_selector_t selector) {
    lv_obj_set_style_opa_layered(obj,value,selector);
}

void stub_lv_obj_set_style_color_filter_dsc(lv_obj_t * obj, lv_color_filter_dsc_t * value, lv_style_selector_t selector) {
    lv_obj_set_style_color_filter_dsc(obj,value,selector);
}

void stub_lv_obj_set_style_color_filter_opa(lv_obj_t * obj, lv_opa_t value, lv_style_selector_t selector) {
    lv_obj_set_style_color_filter_opa(obj,value,selector);
}

void stub_lv_obj_set_style_anim(lv_obj_t * obj, lv_anim_t * value, lv_style_selector_t selector) {
    lv_obj_set_style_anim(obj,value,selector);
}

void stub_lv_obj_set_style_anim_duration(lv_obj_t * obj, uint32_t value, lv_style_selector_t selector) {
    lv_obj_set_style_anim_duration(obj,value,selector);
}

void stub_lv_obj_set_style_transition(lv_obj_t * obj, lv_style_transition_dsc_t * value, lv_style_selector_t selector) {
    lv_obj_set_style_transition(obj,value,selector);
}

void stub_lv_obj_set_style_blend_mode(lv_obj_t * obj, lv_blend_mode_t value, lv_style_selector_t selector) {
    lv_obj_set_style_blend_mode(obj,value,selector);
}

void stub_lv_obj_set_style_layout(lv_obj_t * obj, uint16_t value, lv_style_selector_t selector) {
    lv_obj_set_style_layout(obj,value,selector);
}

void stub_lv_obj_set_style_base_dir(lv_obj_t * obj, lv_base_dir_t value, lv_style_selector_t selector) {
    lv_obj_set_style_base_dir(obj,value,selector);
}

void stub_lv_obj_set_style_bitmap_mask_src(lv_obj_t * obj, void * value, lv_style_selector_t selector) {
    lv_obj_set_style_bitmap_mask_src(obj,value,selector);
}

void stub_lv_obj_set_style_rotary_sensitivity(lv_obj_t * obj, uint32_t value, lv_style_selector_t selector) {
    lv_obj_set_style_rotary_sensitivity(obj,value,selector);
}

void stub_lv_obj_set_style_flex_flow(lv_obj_t * obj, lv_flex_flow_t value, lv_style_selector_t selector) {
    lv_obj_set_style_flex_flow(obj,value,selector);
}

void stub_lv_obj_set_style_flex_main_place(lv_obj_t * obj, lv_flex_align_t value, lv_style_selector_t selector) {
    lv_obj_set_style_flex_main_place(obj,value,selector);
}

void stub_lv_obj_set_style_flex_cross_place(lv_obj_t * obj, lv_flex_align_t value, lv_style_selector_t selector) {
    lv_obj_set_style_flex_cross_place(obj,value,selector);
}

void stub_lv_obj_set_style_flex_track_place(lv_obj_t * obj, lv_flex_align_t value, lv_style_selector_t selector) {
    lv_obj_set_style_flex_track_place(obj,value,selector);
}

void stub_lv_obj_set_style_flex_grow(lv_obj_t * obj, uint8_t value, lv_style_selector_t selector) {
    lv_obj_set_style_flex_grow(obj,value,selector);
}

void stub_lv_obj_set_style_grid_column_dsc_array(lv_obj_t * obj, int32_t * value, lv_style_selector_t selector) {
    lv_obj_set_style_grid_column_dsc_array(obj,value,selector);
}

void stub_lv_obj_set_style_grid_column_align(lv_obj_t * obj, lv_grid_align_t value, lv_style_selector_t selector) {
    lv_obj_set_style_grid_column_align(obj,value,selector);
}

void stub_lv_obj_set_style_grid_row_dsc_array(lv_obj_t * obj, int32_t * value, lv_style_selector_t selector) {
    lv_obj_set_style_grid_row_dsc_array(obj,value,selector);
}

void stub_lv_obj_set_style_grid_row_align(lv_obj_t * obj, lv_grid_align_t value, lv_style_selector_t selector) {
    lv_obj_set_style_grid_row_align(obj,value,selector);
}

void stub_lv_obj_set_style_grid_cell_column_pos(lv_obj_t * obj, int32_t value, lv_style_selector_t selector) {
    lv_obj_set_style_grid_cell_column_pos(obj,value,selector);
}

void stub_lv_obj_set_style_grid_cell_x_align(lv_obj_t * obj, lv_grid_align_t value, lv_style_selector_t selector) {
    lv_obj_set_style_grid_cell_x_align(obj,value,selector);
}

void stub_lv_obj_set_style_grid_cell_column_span(lv_obj_t * obj, int32_t value, lv_style_selector_t selector) {
    lv_obj_set_style_grid_cell_column_span(obj,value,selector);
}

void stub_lv_obj_set_style_grid_cell_row_pos(lv_obj_t * obj, int32_t value, lv_style_selector_t selector) {
    lv_obj_set_style_grid_cell_row_pos(obj,value,selector);
}

void stub_lv_obj_set_style_grid_cell_y_align(lv_obj_t * obj, lv_grid_align_t value, lv_style_selector_t selector) {
    lv_obj_set_style_grid_cell_y_align(obj,value,selector);
}

void stub_lv_obj_set_style_grid_cell_row_span(lv_obj_t * obj, int32_t value, lv_style_selector_t selector) {
    lv_obj_set_style_grid_cell_row_span(obj,value,selector);
}

void stub_lv_obj_set_style_pad_all(lv_obj_t * obj, int32_t value, lv_style_selector_t selector) {
    lv_obj_set_style_pad_all(obj,value,selector);
}

void stub_lv_obj_set_style_pad_hor(lv_obj_t * obj, int32_t value, lv_style_selector_t selector) {
    lv_obj_set_style_pad_hor(obj,value,selector);
}

void stub_lv_obj_set_style_pad_ver(lv_obj_t * obj, int32_t value, lv_style_selector_t selector) {
    lv_obj_set_style_pad_ver(obj,value,selector);
}

void stub_lv_obj_set_style_margin_all(lv_obj_t * obj, int32_t value, lv_style_selector_t selector) {
    lv_obj_set_style_margin_all(obj,value,selector);
}

void stub_lv_obj_set_style_margin_hor(lv_obj_t * obj, int32_t value, lv_style_selector_t selector) {
    lv_obj_set_style_margin_hor(obj,value,selector);
}

void stub_lv_obj_set_style_margin_ver(lv_obj_t * obj, int32_t value, lv_style_selector_t selector) {
    lv_obj_set_style_margin_ver(obj,value,selector);
}

void stub_lv_obj_set_style_pad_gap(lv_obj_t * obj, int32_t value, lv_style_selector_t selector) {
    lv_obj_set_style_pad_gap(obj,value,selector);
}

void stub_lv_obj_set_style_size(lv_obj_t * obj, int32_t width, int32_t height, lv_style_selector_t selector) {
    lv_obj_set_style_size(obj,width,height,selector);
}

void stub_lv_obj_set_style_transform_scale(lv_obj_t * obj, int32_t value, lv_style_selector_t selector) {
    lv_obj_set_style_transform_scale(obj,value,selector);
}

int32_t stub_lv_obj_get_style_space_left(lv_obj_t * obj, lv_part_t part) {
    return lv_obj_get_style_space_left(obj,part);
}

int32_t stub_lv_obj_get_style_space_right(lv_obj_t * obj, lv_part_t part) {
    return lv_obj_get_style_space_right(obj,part);
}

int32_t stub_lv_obj_get_style_space_top(lv_obj_t * obj, lv_part_t part) {
    return lv_obj_get_style_space_top(obj,part);
}

int32_t stub_lv_obj_get_style_space_bottom(lv_obj_t * obj, lv_part_t part) {
    return lv_obj_get_style_space_bottom(obj,part);
}

lv_text_align_t stub_lv_obj_calculate_style_text_align(lv_obj_t * obj, lv_part_t part, char * txt) {
    return lv_obj_calculate_style_text_align(obj,part,txt);
}

int32_t stub_lv_obj_get_style_transform_scale_x_safe(lv_obj_t * obj, lv_part_t part) {
    return lv_obj_get_style_transform_scale_x_safe(obj,part);
}

int32_t stub_lv_obj_get_style_transform_scale_y_safe(lv_obj_t * obj, lv_part_t part) {
    return lv_obj_get_style_transform_scale_y_safe(obj,part);
}

/*
Get the opa style property from all parents and multiply and >> 8 them. the final opacity considering the parents' opacity too 
*/
lv_opa_t stub_lv_obj_get_style_opa_recursive(lv_obj_t * obj, lv_part_t part) {
    return lv_obj_get_style_opa_recursive(obj,part);
}

/*
Compute the color in the given gradient and fraction Gradient are specified in a virtual [0-255] range, so this function scales the virtual range to the given range 
*/
void stub_lv_gradient_color_calculate(lv_grad_dsc_t * dsc, int32_t range, int32_t frac, lv_grad_color_t * color_out, lv_opa_t * opa_out) {
    lv_gradient_color_calculate(dsc,range,frac,color_out,opa_out);
}

/*
Get a gradient cache from the given parameters 
*/
lv_grad_t * stub_lv_gradient_get(lv_grad_dsc_t * gradient, int32_t w, int32_t h) {
    return lv_gradient_get(gradient,w,h);
}

/*
Clean up the gradient item after it was get with lv_grad_get_from_cache . 
*/
void stub_lv_gradient_cleanup(lv_grad_t * grad) {
    lv_gradient_cleanup(grad);
}

/*
Initialize gradient color map from a table 
*/
void stub_lv_gradient_init_stops(lv_grad_dsc_t * grad, lv_color_t colors[], lv_opa_t opa[], uint8_t fracs[], int num_stops) {
    lv_gradient_init_stops(grad,colors,opa,fracs,num_stops);
}

/*
Initialize a rectangle draw descriptor. 
*/
void stub_lv_draw_rect_dsc_init(lv_draw_rect_dsc_t * dsc) {
    lv_draw_rect_dsc_init(dsc);
}

/*
Initialize a fill draw descriptor. 
*/
void stub_lv_draw_fill_dsc_init(lv_draw_fill_dsc_t * dsc) {
    lv_draw_fill_dsc_init(dsc);
}

/*
Try to get a fill draw descriptor from a draw task. the task's draw descriptor or NULL if the task is not of type LV_DRAW_TASK_TYPE_FILL 
*/
lv_draw_fill_dsc_t * stub_lv_draw_task_get_fill_dsc(lv_draw_task_t * task) {
    return lv_draw_task_get_fill_dsc(task);
}

/*
Initialize a border draw descriptor. 
*/
void stub_lv_draw_border_dsc_init(lv_draw_border_dsc_t * dsc) {
    lv_draw_border_dsc_init(dsc);
}

/*
Try to get a border draw descriptor from a draw task. the task's draw descriptor or NULL if the task is not of type LV_DRAW_TASK_TYPE_BORDER 
*/
lv_draw_border_dsc_t * stub_lv_draw_task_get_border_dsc(lv_draw_task_t * task) {
    return lv_draw_task_get_border_dsc(task);
}

/*
Initialize a box shadow draw descriptor. 
*/
void stub_lv_draw_box_shadow_dsc_init(lv_draw_box_shadow_dsc_t * dsc) {
    lv_draw_box_shadow_dsc_init(dsc);
}

/*
Try to get a box shadow draw descriptor from a draw task. the task's draw descriptor or NULL if the task is not of type LV_DRAW_TASK_TYPE_BOX_SHADOW 
*/
lv_draw_box_shadow_dsc_t * stub_lv_draw_task_get_box_shadow_dsc(lv_draw_task_t * task) {
    return lv_draw_task_get_box_shadow_dsc(task);
}

/*
The rectangle is a wrapper for fill, border, bg. image and box shadow. Internally fill, border, image and box shadow draw tasks will be created. 
*/
void stub_lv_draw_rect(lv_layer_t * layer, lv_draw_rect_dsc_t * dsc, lv_area_t * coords) {
    lv_draw_rect(layer,dsc,coords);
}

/*
Initialize a label draw descriptor 
*/
void stub_lv_draw_label_dsc_init(lv_draw_label_dsc_t * dsc) {
    lv_draw_label_dsc_init(dsc);
}

/*
Try to get a label draw descriptor from a draw task. the task's draw descriptor or NULL if the task is not of type LV_DRAW_TASK_TYPE_LABEL 
*/
lv_draw_label_dsc_t * stub_lv_draw_task_get_label_dsc(lv_draw_task_t * task) {
    return lv_draw_task_get_label_dsc(task);
}

/*
Initialize a glyph draw descriptor. Used internally. 
*/
void stub_lv_draw_glyph_dsc_init(lv_draw_glyph_dsc_t * dsc) {
    lv_draw_glyph_dsc_init(dsc);
}

/*
Crate a draw task to render a text 
*/
void stub_lv_draw_label(lv_layer_t * layer, lv_draw_label_dsc_t * dsc, lv_area_t * coords) {
    lv_draw_label(layer,dsc,coords);
}

/*
Crate a draw task to render a single character 
*/
void stub_lv_draw_character(lv_layer_t * layer, lv_draw_label_dsc_t * dsc, lv_point_t * point, uint32_t unicode_letter) {
    lv_draw_character(layer,dsc,point,unicode_letter);
}

/*
Should be used during rendering the characters to get the position and other parameters of the characters 
*/
void stub_lv_draw_label_iterate_characters(lv_draw_unit_t * draw_unit, lv_draw_label_dsc_t * dsc, lv_area_t * coords, lv_draw_glyph_cb_t cb) {
    lv_draw_label_iterate_characters(draw_unit,dsc,coords,cb);
}

/*
Initialize an image draw descriptor. 
*/
void stub_lv_draw_image_dsc_init(lv_draw_image_dsc_t * dsc) {
    lv_draw_image_dsc_init(dsc);
}

/*
Try to get an image draw descriptor from a draw task. the task's draw descriptor or NULL if the task is not of type LV_DRAW_TASK_TYPE_IMAGE 
*/
lv_draw_image_dsc_t * stub_lv_draw_task_get_image_dsc(lv_draw_task_t * task) {
    return lv_draw_task_get_image_dsc(task);
}

/*
Create an image draw task coords can be small than the real image area (if only a part of the image is rendered) or can be larger (in case of tiled images). . 
*/
void stub_lv_draw_image(lv_layer_t * layer, lv_draw_image_dsc_t * dsc, lv_area_t * coords) {
    lv_draw_image(layer,dsc,coords);
}

/*
Create a draw task to blend a layer to another layer coords can be small than the total widget area from which the layer is created (if only a part of the widget was rendered to a layer) 
*/
void stub_lv_draw_layer(lv_layer_t * layer, lv_draw_image_dsc_t * dsc, lv_area_t * coords) {
    lv_draw_layer(layer,dsc,coords);
}

/*
Get the type of an image source type of the image source LV_IMAGE_SRC_VARIABLE/FILE/SYMBOL/UNKNOWN 
*/
lv_image_src_t stub_lv_image_src_get_type(void * src) {
    return lv_image_src_get_type(src);
}

/*
Initialize a line draw descriptor 
*/
void stub_lv_draw_line_dsc_init(lv_draw_line_dsc_t * dsc) {
    lv_draw_line_dsc_init(dsc);
}

/*
Try to get a line draw descriptor from a draw task. the task's draw descriptor or NULL if the task is not of type LV_DRAW_TASK_TYPE_LINE 
*/
lv_draw_line_dsc_t * stub_lv_draw_task_get_line_dsc(lv_draw_task_t * task) {
    return lv_draw_task_get_line_dsc(task);
}

/*
Create a line draw task 
*/
void stub_lv_draw_line(lv_layer_t * layer, lv_draw_line_dsc_t * dsc) {
    lv_draw_line(layer,dsc);
}

/*
Initialize an arc draw descriptor. 
*/
void stub_lv_draw_arc_dsc_init(lv_draw_arc_dsc_t * dsc) {
    lv_draw_arc_dsc_init(dsc);
}

/*
Try to get an arc draw descriptor from a draw task. the task's draw descriptor or NULL if the task is not of type LV_DRAW_TASK_TYPE_ARC 
*/
lv_draw_arc_dsc_t * stub_lv_draw_task_get_arc_dsc(lv_draw_task_t * task) {
    return lv_draw_task_get_arc_dsc(task);
}

/*
Create an arc draw task. 
*/
void stub_lv_draw_arc(lv_layer_t * layer, lv_draw_arc_dsc_t * dsc) {
    lv_draw_arc(layer,dsc);
}

/*
Get an area the should be invalidated when the arcs angle changed between start_angle and end_ange 
*/
void stub_lv_draw_arc_get_area(int32_t x, int32_t y, uint16_t radius, lv_value_precise_t start_angle, lv_value_precise_t end_angle, int32_t w, bool rounded, lv_area_t * area) {
    lv_draw_arc_get_area(x,y,radius,start_angle,end_angle,w,rounded,area);
}

/*
Initialize a rectangle draw descriptor from an object's styles in its current state Only the relevant fields will be set. E.g. if border width == 0 the other border properties won't be evaluated. 
*/
void stub_lv_obj_init_draw_rect_dsc(lv_obj_t * obj, lv_part_t part, lv_draw_rect_dsc_t * draw_dsc) {
    lv_obj_init_draw_rect_dsc(obj,part,draw_dsc);
}

/*
Initialize a label draw descriptor from an object's styles in its current state 
*/
void stub_lv_obj_init_draw_label_dsc(lv_obj_t * obj, lv_part_t part, lv_draw_label_dsc_t * draw_dsc) {
    lv_obj_init_draw_label_dsc(obj,part,draw_dsc);
}

/*
Initialize an image draw descriptor from an object's styles in its current state 
*/
void stub_lv_obj_init_draw_image_dsc(lv_obj_t * obj, lv_part_t part, lv_draw_image_dsc_t * draw_dsc) {
    lv_obj_init_draw_image_dsc(obj,part,draw_dsc);
}

/*
Initialize a line draw descriptor from an object's styles in its current state 
*/
void stub_lv_obj_init_draw_line_dsc(lv_obj_t * obj, lv_part_t part, lv_draw_line_dsc_t * draw_dsc) {
    lv_obj_init_draw_line_dsc(obj,part,draw_dsc);
}

/*
Initialize an arc draw descriptor from an object's styles in its current state 
*/
void stub_lv_obj_init_draw_arc_dsc(lv_obj_t * obj, lv_part_t part, lv_draw_arc_dsc_t * draw_dsc) {
    lv_obj_init_draw_arc_dsc(obj,part,draw_dsc);
}

/*
Get the required extra size (around the object's part) to draw shadow, outline, value etc. the extra size required around the object 
*/
int32_t stub_lv_obj_calculate_ext_draw_size(lv_obj_t * obj, lv_part_t part) {
    return lv_obj_calculate_ext_draw_size(obj,part);
}

/*
Send a 'LV_EVENT_REFR_EXT_DRAW_SIZE' Call the ancestor's event handler to the object to refresh the value of the extended draw size. The result will be saved in obj . 
*/
void stub_lv_obj_refresh_ext_draw_size(lv_obj_t * obj) {
    lv_obj_refresh_ext_draw_size(obj);
}

/*
Create an object form a class descriptor pointer to the created object 
*/
lv_obj_t * stub_lv_obj_class_create_obj(lv_obj_class_t * class_p, lv_obj_t * parent) {
    return lv_obj_class_create_obj(class_p,parent);
}

void stub_lv_obj_class_init_obj(lv_obj_t * obj) {
    lv_obj_class_init_obj(obj);
}

bool stub_lv_obj_is_editable(lv_obj_t * obj) {
    return lv_obj_is_editable(obj);
}

bool stub_lv_obj_is_group_def(lv_obj_t * obj) {
    return lv_obj_is_group_def(obj);
}

/*
Create a new object group pointer to the new object group 
*/
lv_group_t * stub_lv_group_create(void) {
    return lv_group_create();
}

/*
Delete a group object 
*/
void stub_lv_group_delete(lv_group_t * group) {
    lv_group_delete(group);
}

/*
Set a default group. New object are added to this group if it's enabled in their class with add_to_def_group = true 
*/
void stub_lv_group_set_default(lv_group_t * group) {
    lv_group_set_default(group);
}

/*
Get the default group pointer to the default group 
*/
lv_group_t * stub_lv_group_get_default(void) {
    return lv_group_get_default();
}

/*
Add an object to a group 
*/
void stub_lv_group_add_obj(lv_group_t * group, lv_obj_t * obj) {
    lv_group_add_obj(group,obj);
}

/*
Swap 2 object in a group. The object must be in the same group 
*/
void stub_lv_group_swap_obj(lv_obj_t * obj1, lv_obj_t * obj2) {
    lv_group_swap_obj(obj1,obj2);
}

/*
Remove an object from its group 
*/
void stub_lv_group_remove_obj(lv_obj_t * obj) {
    lv_group_remove_obj(obj);
}

/*
Remove all objects from a group 
*/
void stub_lv_group_remove_all_objs(lv_group_t * group) {
    lv_group_remove_all_objs(group);
}

/*
Focus on an object (defocus the current) 
*/
void stub_lv_group_focus_obj(lv_obj_t * obj) {
    lv_group_focus_obj(obj);
}

/*
Focus the next object in a group (defocus the current) 
*/
void stub_lv_group_focus_next(lv_group_t * group) {
    lv_group_focus_next(group);
}

/*
Focus the previous object in a group (defocus the current) 
*/
void stub_lv_group_focus_prev(lv_group_t * group) {
    lv_group_focus_prev(group);
}

/*
Do not let to change the focus from the current object 
*/
void stub_lv_group_focus_freeze(lv_group_t * group, bool en) {
    lv_group_focus_freeze(group,en);
}

/*
Send a control character to the focuses object of a group result of focused object in group. 
*/
lv_result_t stub_lv_group_send_data(lv_group_t * group, uint32_t c) {
    return lv_group_send_data(group,c);
}

/*
Set a function for a group which will be called when a new object is focused 
*/
void stub_lv_group_set_focus_cb(lv_group_t * group, lv_group_focus_cb_t focus_cb) {
    lv_group_set_focus_cb(group,focus_cb);
}

/*
Set a function for a group which will be called when a focus edge is reached 
*/
void stub_lv_group_set_edge_cb(lv_group_t * group, lv_group_edge_cb_t edge_cb) {
    lv_group_set_edge_cb(group,edge_cb);
}

/*
Set whether the next or previous item in a group is focused if the currently focused obj is deleted. 
*/
void stub_lv_group_set_refocus_policy(lv_group_t * group, lv_group_refocus_policy_t policy) {
    lv_group_set_refocus_policy(group,policy);
}

/*
Manually set the current mode (edit or navigate). 
*/
void stub_lv_group_set_editing(lv_group_t * group, bool edit) {
    lv_group_set_editing(group,edit);
}

/*
Set whether focus next/prev will allow wrapping from first->last or last->first object. 
*/
void stub_lv_group_set_wrap(lv_group_t * group, bool en) {
    lv_group_set_wrap(group,en);
}

/*
Get the focused object or NULL if there isn't one pointer to the focused object 
*/
lv_obj_t * stub_lv_group_get_focused(lv_group_t * group) {
    return lv_group_get_focused(group);
}

/*
Get the focus callback function of a group the call back function or NULL if not set 
*/
lv_group_focus_cb_t stub_lv_group_get_focus_cb(lv_group_t * group) {
    return lv_group_get_focus_cb(group);
}

/*
Get the edge callback function of a group the call back function or NULL if not set 
*/
lv_group_edge_cb_t stub_lv_group_get_edge_cb(lv_group_t * group) {
    return lv_group_get_edge_cb(group);
}

/*
Get the current mode (edit or navigate). true: edit mode; false: navigate mode 
*/
bool stub_lv_group_get_editing(lv_group_t * group) {
    return lv_group_get_editing(group);
}

/*
Get whether focus next/prev will allow wrapping from first->last or last->first object. 
*/
bool stub_lv_group_get_wrap(lv_group_t * group) {
    return lv_group_get_wrap(group);
}

/*
Get the number of object in the group number of objects in the group 
*/
uint32_t stub_lv_group_get_obj_count(lv_group_t * group) {
    return lv_group_get_obj_count(group);
}

/*
Get the nth object within a group pointer to the object 
*/
lv_obj_t * stub_lv_group_get_obj_by_index(lv_group_t * group, uint32_t index) {
    return lv_group_get_obj_by_index(group,index);
}

/*
Get the number of groups number of groups 
*/
uint32_t stub_lv_group_get_count(void) {
    return lv_group_get_count();
}

/*
Get a group by its index pointer to the group 
*/
lv_group_t * stub_lv_group_by_index(uint32_t index) {
    return lv_group_by_index(index);
}

/*
Create an indev Pointer to the created indev or NULL when allocation failed 
*/
lv_indev_t * stub_lv_indev_create(void) {
    return lv_indev_create();
}

/*
Remove the provided input device. Make sure not to use the provided input device afterwards anymore. 
*/
void stub_lv_indev_delete(lv_indev_t * indev) {
    lv_indev_delete(indev);
}

/*
Get the next input device. the next input device or NULL if there are no more. Provide the first input device when the parameter is NULL 
*/
lv_indev_t * stub_lv_indev_get_next(lv_indev_t * indev) {
    return lv_indev_get_next(indev);
}

/*
Read data from an input device. 
*/
void stub_lv_indev_read(lv_indev_t * indev) {
    lv_indev_read(indev);
}

/*
Called periodically to read the input devices 
*/
void stub_lv_indev_read_timer_cb(lv_timer_t * timer) {
    lv_indev_read_timer_cb(timer);
}

/*
Enable or disable one or all input devices (default enabled) 
*/
void stub_lv_indev_enable(lv_indev_t * indev, bool enable) {
    lv_indev_enable(indev,enable);
}

/*
Get the currently processed input device. Can be used in action functions too. pointer to the currently processed input device or NULL if no input device processing right now 
*/
lv_indev_t * stub_lv_indev_active(void) {
    return lv_indev_active();
}

/*
Set the type of an input device 
*/
void stub_lv_indev_set_type(lv_indev_t * indev, lv_indev_type_t indev_type) {
    lv_indev_set_type(indev,indev_type);
}

/*
Set a callback function to read input device data to the indev 
*/
void stub_lv_indev_set_read_cb(lv_indev_t * indev, lv_indev_read_cb_t read_cb) {
    lv_indev_set_read_cb(indev,read_cb);
}

/*
Set user data to the indev 
*/
void stub_lv_indev_set_user_data(lv_indev_t * indev, void * user_data) {
    lv_indev_set_user_data(indev,user_data);
}

/*
Set driver data to the indev 
*/
void stub_lv_indev_set_driver_data(lv_indev_t * indev, void * driver_data) {
    lv_indev_set_driver_data(indev,driver_data);
}

/*
Assign a display to the indev 
*/
void stub_lv_indev_set_display(lv_indev_t * indev, struct _lv_display_t * disp) {
    lv_indev_set_display(indev,disp);
}

/*
Set long press time to indev 
*/
void stub_lv_indev_set_long_press_time(lv_indev_t * indev, uint16_t long_press_time) {
    lv_indev_set_long_press_time(indev,long_press_time);
}

/*
Set scroll limit to the input device 
*/
void stub_lv_indev_set_scroll_limit(lv_indev_t * indev, uint8_t scroll_limit) {
    lv_indev_set_scroll_limit(indev,scroll_limit);
}

/*
Set scroll throw slow-down to the indev. Greater value means faster slow-down 
*/
void stub_lv_indev_set_scroll_throw(lv_indev_t * indev, uint8_t scroll_throw) {
    lv_indev_set_scroll_throw(indev,scroll_throw);
}

/*
Get the type of an input device the type of the input device from lv_hal_indev_type_t ( LV_INDEV_TYPE_... ) 
*/
lv_indev_type_t stub_lv_indev_get_type(lv_indev_t * indev) {
    return lv_indev_get_type(indev);
}

/*
Get the callback function to read input device data to the indev Pointer to callback function to read input device data or NULL if indev is NULL 
*/
lv_indev_read_cb_t stub_lv_indev_get_read_cb(lv_indev_t * indev) {
    return lv_indev_get_read_cb(indev);
}

/*
Get the indev state Indev state or LV_INDEV_STATE_RELEASED if indev is NULL 
*/
lv_indev_state_t stub_lv_indev_get_state(lv_indev_t * indev) {
    return lv_indev_get_state(indev);
}

/*
Get the indev assigned group Pointer to indev assigned group or NULL if indev is NULL 
*/
lv_group_t * stub_lv_indev_get_group(lv_indev_t * indev) {
    return lv_indev_get_group(indev);
}

/*
Get a pointer to the assigned display of the indev pointer to the assigned display or NULL if indev is NULL 
*/
lv_display_t * stub_lv_indev_get_display(lv_indev_t * indev) {
    return lv_indev_get_display(indev);
}

/*
Get a pointer to the user data of the indev pointer to the user data or NULL if indev is NULL 
*/
void * stub_lv_indev_get_user_data(lv_indev_t * indev) {
    return lv_indev_get_user_data(indev);
}

/*
Get a pointer to the driver data of the indev pointer to the driver data or NULL if indev is NULL 
*/
void * stub_lv_indev_get_driver_data(lv_indev_t * indev) {
    return lv_indev_get_driver_data(indev);
}

/*
Get whether indev is moved while pressed true: indev is moved while pressed; false: indev is not moved while pressed 
*/
bool stub_lv_indev_get_press_moved(lv_indev_t * indev) {
    return lv_indev_get_press_moved(indev);
}

/*
Reset one or all input devices 
*/
void stub_lv_indev_reset(lv_indev_t * indev, lv_obj_t * obj) {
    lv_indev_reset(indev,obj);
}

/*
Touch and key related events are sent to the input device first and to the widget after that. If this functions called in an indev event, the event won't be sent to the widget. 
*/
void stub_lv_indev_stop_processing(lv_indev_t * indev) {
    lv_indev_stop_processing(indev);
}

/*
Reset the long press state of an input device 
*/
void stub_lv_indev_reset_long_press(lv_indev_t * indev) {
    lv_indev_reset_long_press(indev);
}

/*
Set a cursor for a pointer input device (for LV_INPUT_TYPE_POINTER and LV_INPUT_TYPE_BUTTON) 
*/
void stub_lv_indev_set_cursor(lv_indev_t * indev, lv_obj_t * cur_obj) {
    lv_indev_set_cursor(indev,cur_obj);
}

/*
Set a destination group for a keypad input device (for LV_INDEV_TYPE_KEYPAD) 
*/
void stub_lv_indev_set_group(lv_indev_t * indev, lv_group_t * group) {
    lv_indev_set_group(indev,group);
}

/*
Set the an array of points for LV_INDEV_TYPE_BUTTON. These points will be assigned to the buttons to press a specific point on the screen 
*/
void stub_lv_indev_set_button_points(lv_indev_t * indev, lv_point_t points[]) {
    lv_indev_set_button_points(indev,points);
}

/*
Get the last point of an input device (for LV_INDEV_TYPE_POINTER and LV_INDEV_TYPE_BUTTON) 
*/
void stub_lv_indev_get_point(lv_indev_t * indev, lv_point_t * point) {
    lv_indev_get_point(indev,point);
}

/*
Get the current gesture direct current gesture direct 
*/
lv_dir_t stub_lv_indev_get_gesture_dir(lv_indev_t * indev) {
    return lv_indev_get_gesture_dir(indev);
}

/*
Get the last pressed key of an input device (for LV_INDEV_TYPE_KEYPAD) the last pressed key (0 on error) 
*/
uint32_t stub_lv_indev_get_key(lv_indev_t * indev) {
    return lv_indev_get_key(indev);
}

/*
Get the counter for consecutive clicks within a short distance and time. The counter is updated before LV_EVENT_SHORT_CLICKED is fired. short click streak counter 
*/
uint8_t stub_lv_indev_get_short_click_streak(lv_indev_t * indev) {
    return lv_indev_get_short_click_streak(indev);
}

/*
Check the current scroll direction of an input device (for LV_INDEV_TYPE_POINTER and LV_INDEV_TYPE_BUTTON) LV_DIR_NONE: no scrolling now LV_DIR_HOR/VER 
*/
lv_dir_t stub_lv_indev_get_scroll_dir(lv_indev_t * indev) {
    return lv_indev_get_scroll_dir(indev);
}

/*
Get the currently scrolled object (for LV_INDEV_TYPE_POINTER and LV_INDEV_TYPE_BUTTON) pointer to the currently scrolled object or NULL if no scrolling by this indev 
*/
lv_obj_t * stub_lv_indev_get_scroll_obj(lv_indev_t * indev) {
    return lv_indev_get_scroll_obj(indev);
}

/*
Get the movement vector of an input device (for LV_INDEV_TYPE_POINTER and LV_INDEV_TYPE_BUTTON) 
*/
void stub_lv_indev_get_vect(lv_indev_t * indev, lv_point_t * point) {
    lv_indev_get_vect(indev,point);
}

/*
Do nothing until the next release 
*/
void stub_lv_indev_wait_release(lv_indev_t * indev) {
    lv_indev_wait_release(indev);
}

/*
Gets a pointer to the currently active object in the currently processed input device. pointer to currently active object or NULL if no active object 
*/
lv_obj_t * stub_lv_indev_get_active_obj(void) {
    return lv_indev_get_active_obj();
}

/*
Get a pointer to the indev read timer to modify its parameters with lv_timer_... functions. pointer to the indev read refresher timer. (NULL on error) 
*/
lv_timer_t * stub_lv_indev_get_read_timer(lv_indev_t * indev) {
    return lv_indev_get_read_timer(indev);
}

/*
Set the input device's event model: event-driven mode or timer mode. 
*/
void stub_lv_indev_set_mode(lv_indev_t * indev, lv_indev_mode_t mode) {
    lv_indev_set_mode(indev,mode);
}

/*
Get the input device's running mode. the running mode for the specified input device. 
*/
lv_indev_mode_t stub_lv_indev_get_mode(lv_indev_t * indev) {
    return lv_indev_get_mode(indev);
}

/*
Search the most top, clickable object by a point pointer to the found object or NULL if there was no suitable object 
*/
lv_obj_t * stub_lv_indev_search_obj(lv_obj_t * obj, lv_point_t * point) {
    return lv_indev_search_obj(obj,point);
}

/*
Add an event handler to the indev 
*/
void stub_lv_indev_add_event_cb(lv_indev_t * indev, lv_event_cb_t event_cb, lv_event_code_t filter, void * user_data) {
    lv_indev_add_event_cb(indev,event_cb,filter,user_data);
}

/*
Get the number of event attached to an indev number of events 
*/
uint32_t stub_lv_indev_get_event_count(lv_indev_t * indev) {
    return lv_indev_get_event_count(indev);
}

/*
Get an event descriptor for an event the event descriptor 
*/
lv_event_dsc_t * stub_lv_indev_get_event_dsc(lv_indev_t * indev, uint32_t index) {
    return lv_indev_get_event_dsc(indev,index);
}

/*
Remove an event true: and event was removed; false: no event was removed 
*/
bool stub_lv_indev_remove_event(lv_indev_t * indev, uint32_t index) {
    return lv_indev_remove_event(indev,index);
}

/*
Remove an event_cb with user_data the count of the event removed 
*/
uint32_t stub_lv_indev_remove_event_cb_with_user_data(lv_indev_t * indev, lv_event_cb_t event_cb, void * user_data) {
    return lv_indev_remove_event_cb_with_user_data(indev,event_cb,user_data);
}

/*
Send an event to an indev LV_RESULT_OK: indev wasn't deleted in the event. 
*/
lv_result_t stub_lv_indev_send_event(lv_indev_t * indev, lv_event_code_t code, void * param) {
    return lv_indev_send_event(indev,code,param);
}

/*
Send an event to the object LV_RESULT_OK: obj was not deleted in the event; LV_RESULT_INVALID: obj was deleted in the event_code 
*/
lv_result_t stub_lv_obj_send_event(lv_obj_t * obj, lv_event_code_t event_code, void * param) {
    return lv_obj_send_event(obj,event_code,param);
}

/*
Used by the widgets internally to call the ancestor widget types's event handler LV_RESULT_OK: the target object was not deleted in the event; LV_RESULT_INVALID: it was deleted in the event_code 
*/
lv_result_t stub_lv_obj_event_base(lv_obj_class_t * class_p, lv_event_t * e) {
    return lv_obj_event_base(class_p,e);
}

/*
Get the current target of the event. It's the object which event handler being called. If the event is not bubbled it's the same as "original" target. the target of the event_code 
*/
lv_obj_t * stub_lv_event_get_current_target_obj(lv_event_t * e) {
    return lv_event_get_current_target_obj(e);
}

/*
Get the object originally targeted by the event. It's the same even if the event is bubbled. pointer to the original target of the event_code 
*/
lv_obj_t * stub_lv_event_get_target_obj(lv_event_t * e) {
    return lv_event_get_target_obj(e);
}

/*
Add an event handler function for an object. Used by the user to react on event which happens with the object. An object can have multiple event handler. They will be called in the same order as they were added. handler to the event. It can be used in lv_obj_remove_event_dsc . 
*/
lv_event_dsc_t * stub_lv_obj_add_event_cb(lv_obj_t * obj, lv_event_cb_t event_cb, lv_event_code_t filter, void * user_data) {
    return lv_obj_add_event_cb(obj,event_cb,filter,user_data);
}

uint32_t stub_lv_obj_get_event_count(lv_obj_t * obj) {
    return lv_obj_get_event_count(obj);
}

lv_event_dsc_t * stub_lv_obj_get_event_dsc(lv_obj_t * obj, uint32_t index) {
    return lv_obj_get_event_dsc(obj,index);
}

bool stub_lv_obj_remove_event(lv_obj_t * obj, uint32_t index) {
    return lv_obj_remove_event(obj,index);
}

bool stub_lv_obj_remove_event_cb(lv_obj_t * obj, lv_event_cb_t event_cb) {
    return lv_obj_remove_event_cb(obj,event_cb);
}

bool stub_lv_obj_remove_event_dsc(lv_obj_t * obj, lv_event_dsc_t * dsc) {
    return lv_obj_remove_event_dsc(obj,dsc);
}

/*
Remove an event_cb with user_data the count of the event removed 
*/
uint32_t stub_lv_obj_remove_event_cb_with_user_data(lv_obj_t * obj, lv_event_cb_t event_cb, void * user_data) {
    return lv_obj_remove_event_cb_with_user_data(obj,event_cb,user_data);
}

/*
Get the input device passed as parameter to indev related events. the indev that triggered the event or NULL if called on a not indev related event 
*/
lv_indev_t * stub_lv_event_get_indev(lv_event_t * e) {
    return lv_event_get_indev(e);
}

/*
Get the draw context which should be the first parameter of the draw functions. Namely: LV_EVENT_DRAW_MAIN/POST , LV_EVENT_DRAW_MAIN/POST_BEGIN , LV_EVENT_DRAW_MAIN/POST_END  pointer to a draw context or NULL if called on an unrelated event 
*/
lv_layer_t * stub_lv_event_get_layer(lv_event_t * e) {
    return lv_event_get_layer(e);
}

/*
Get the old area of the object before its size was changed. Can be used in LV_EVENT_SIZE_CHANGED  the old absolute area of the object or NULL if called on an unrelated event 
*/
lv_area_t * stub_lv_event_get_old_size(lv_event_t * e) {
    return lv_event_get_old_size(e);
}

/*
Get the key passed as parameter to an event. Can be used in LV_EVENT_KEY  the triggering key or NULL if called on an unrelated event 
*/
uint32_t stub_lv_event_get_key(lv_event_t * e) {
    return lv_event_get_key(e);
}

/*
Get the signed rotary encoder diff. passed as parameter to an event. Can be used in LV_EVENT_ROTARY  the triggering key or NULL if called on an unrelated event 
*/
int32_t stub_lv_event_get_rotary_diff(lv_event_t * e) {
    return lv_event_get_rotary_diff(e);
}

/*
Get the animation descriptor of a scrolling. Can be used in LV_EVENT_SCROLL_BEGIN  the animation that will scroll the object. (can be modified as required) 
*/
lv_anim_t * stub_lv_event_get_scroll_anim(lv_event_t * e) {
    return lv_event_get_scroll_anim(e);
}

/*
Set the new extra draw size. Can be used in LV_EVENT_REFR_EXT_DRAW_SIZE 
*/
void stub_lv_event_set_ext_draw_size(lv_event_t * e, int32_t size) {
    lv_event_set_ext_draw_size(e,size);
}

/*
Get a pointer to an :ref:`lv_point_t` variable in which the self size should be saved (width in point->x and height point->y ). Can be used in LV_EVENT_GET_SELF_SIZE  pointer to :ref:`lv_point_t` or NULL if called on an unrelated event 
*/
lv_point_t * stub_lv_event_get_self_size_info(lv_event_t * e) {
    return lv_event_get_self_size_info(e);
}

/*
Get a pointer to an lv_hit_test_info_t variable in which the hit test result should be saved. Can be used in LV_EVENT_HIT_TEST  pointer to lv_hit_test_info_t or NULL if called on an unrelated event 
*/
lv_hit_test_info_t * stub_lv_event_get_hit_test_info(lv_event_t * e) {
    return lv_event_get_hit_test_info(e);
}

/*
Get a pointer to an area which should be examined whether the object fully covers it or not. Can be used in LV_EVENT_HIT_TEST  an area with absolute coordinates to check 
*/
lv_area_t * stub_lv_event_get_cover_area(lv_event_t * e) {
    return lv_event_get_cover_area(e);
}

/*
Set the result of cover checking. Can be used in LV_EVENT_COVER_CHECK 
*/
void stub_lv_event_set_cover_res(lv_event_t * e, lv_cover_res_t res) {
    lv_event_set_cover_res(e,res);
}

/*
Get the draw task which was just added. Can be used in LV_EVENT_DRAW_TASK_ADDED event  the added draw task 
*/
lv_draw_task_t * stub_lv_event_get_draw_task(lv_event_t * e) {
    return lv_event_get_draw_task(e);
}

/*
Create a base object (a rectangle) pointer to the new object 
*/
lv_obj_t * stub_lv_obj_create(lv_obj_t * parent) {
    return lv_obj_create(parent);
}

/*
Set one or more flags 
*/
void stub_lv_obj_add_flag(lv_obj_t * obj, lv_obj_flag_t f) {
    lv_obj_add_flag(obj,f);
}

/*
Remove one or more flags 
*/
void stub_lv_obj_remove_flag(lv_obj_t * obj, lv_obj_flag_t f) {
    lv_obj_remove_flag(obj,f);
}

/*
Set add or remove one or more flags. 
*/
void stub_lv_obj_update_flag(lv_obj_t * obj, lv_obj_flag_t f, bool v) {
    lv_obj_update_flag(obj,f,v);
}

/*
Add one or more states to the object. The other state bits will remain unchanged. If specified in the styles, transition animation will be started from the previous state to the current. 
*/
void stub_lv_obj_add_state(lv_obj_t * obj, lv_state_t state) {
    lv_obj_add_state(obj,state);
}

/*
Remove one or more states to the object. The other state bits will remain unchanged. If specified in the styles, transition animation will be started from the previous state to the current. 
*/
void stub_lv_obj_remove_state(lv_obj_t * obj, lv_state_t state) {
    lv_obj_remove_state(obj,state);
}

/*
Add or remove one or more states to the object. The other state bits will remain unchanged. 
*/
void stub_lv_obj_set_state(lv_obj_t * obj, lv_state_t state, bool v) {
    lv_obj_set_state(obj,state,v);
}

/*
Set the user_data field of the object 
*/
void stub_lv_obj_set_user_data(lv_obj_t * obj, void * user_data) {
    lv_obj_set_user_data(obj,user_data);
}

/*
Check if a given flag or all the given flags are set on an object. true: all flags are set; false: not all flags are set 
*/
bool stub_lv_obj_has_flag(lv_obj_t * obj, lv_obj_flag_t f) {
    return lv_obj_has_flag(obj,f);
}

/*
Check if a given flag or any of the flags are set on an object. true: at least one flag is set; false: none of the flags are set 
*/
bool stub_lv_obj_has_flag_any(lv_obj_t * obj, lv_obj_flag_t f) {
    return lv_obj_has_flag_any(obj,f);
}

/*
Get the state of an object the state (OR-ed values from lv_state_t ) 
*/
lv_state_t stub_lv_obj_get_state(lv_obj_t * obj) {
    return lv_obj_get_state(obj);
}

/*
Check if the object is in a given state or not. true: obj is in state ; false: obj is not in state 
*/
bool stub_lv_obj_has_state(lv_obj_t * obj, lv_state_t state) {
    return lv_obj_has_state(obj,state);
}

/*
Get the group of the object the pointer to group of the object 
*/
lv_group_t * stub_lv_obj_get_group(lv_obj_t * obj) {
    return lv_obj_get_group(obj);
}

/*
Get the user_data field of the object the pointer to the user_data of the object 
*/
void * stub_lv_obj_get_user_data(lv_obj_t * obj) {
    return lv_obj_get_user_data(obj);
}

/*
Allocate special data for an object if not allocated yet. 
*/
void stub_lv_obj_allocate_spec_attr(lv_obj_t * obj) {
    lv_obj_allocate_spec_attr(obj);
}

/*
Check the type of obj. true: class_p is the obj class. 
*/
bool stub_lv_obj_check_type(lv_obj_t * obj, lv_obj_class_t * class_p) {
    return lv_obj_check_type(obj,class_p);
}

/*
Check if any object has a given class (type). It checks the ancestor classes too. true: obj has the given class 
*/
bool stub_lv_obj_has_class(lv_obj_t * obj, lv_obj_class_t * class_p) {
    return lv_obj_has_class(obj,class_p);
}

/*
Get the class (type) of the object the class (type) of the object 
*/
lv_obj_class_t * stub_lv_obj_get_class(lv_obj_t * obj) {
    return lv_obj_get_class(obj);
}

/*
Check if any object is still "alive". true: valid 
*/
bool stub_lv_obj_is_valid(lv_obj_t * obj) {
    return lv_obj_is_valid(obj);
}

/*
Utility to set an object reference to NULL when it gets deleted. The reference should be in a location that will not become invalid during the object's lifetime, i.e. static or allocated. 
*/
void stub_lv_obj_null_on_delete(lv_obj_t * * obj_ptr) {
    lv_obj_null_on_delete(obj_ptr);
}

/*
Redraw the invalidated areas now. Normally the redrawing is periodically executed in lv_timer_handler but a long blocking process can prevent the call of lv_timer_handler . In this case if the GUI is updated in the process (e.g. progress bar) this function can be called when the screen should be updated. 
*/
void stub_lv_refr_now(lv_display_t * disp) {
    lv_refr_now(disp);
}

/*
Redrawn on object and all its children using the passed draw context 
*/
void stub_lv_obj_redraw(lv_layer_t * layer, lv_obj_t * obj) {
    lv_obj_redraw(layer,obj);
}

/*
Loads a lv_font_t object from a binary font file pointer to font where to load 
*/
lv_font_t * stub_lv_binfont_create(char * path) {
    return lv_binfont_create(path);
}

/*
Frees the memory allocated by the :ref:`lv_binfont_create()` function 
*/
void stub_lv_binfont_destroy(lv_font_t * font) {
    lv_binfont_destroy(font);
}

/*
Used as get_glyph_bitmap callback in lvgl's native font format if the font is uncompressed. pointer to an A8 bitmap (not necessarily bitmap_out) or NULL if unicode_letter not found 
*/
void * stub_lv_font_get_bitmap_fmt_txt(lv_font_glyph_dsc_t * g_dsc, lv_draw_buf_t * draw_buf) {
    return lv_font_get_bitmap_fmt_txt(g_dsc,draw_buf);
}

/*
Used as get_glyph_dsc callback in lvgl's native font format if the font is uncompressed. true: descriptor is successfully loaded into dsc_out . false: the letter was not found, no data is loaded to dsc_out 
*/
bool stub_lv_font_get_glyph_dsc_fmt_txt(lv_font_t * font, lv_font_glyph_dsc_t * dsc_out, uint32_t unicode_letter, uint32_t unicode_letter_next) {
    return lv_font_get_glyph_dsc_fmt_txt(font,dsc_out,unicode_letter,unicode_letter_next);
}

/*
Create an image object pointer to the created image 
*/
lv_obj_t * stub_lv_image_create(lv_obj_t * parent) {
    return lv_image_create(parent);
}

/*
Set the image data to display on the object 
*/
void stub_lv_image_set_src(lv_obj_t * obj, void * src) {
    lv_image_set_src(obj,src);
}

/*
Set an offset for the source of an image so the image will be displayed from the new origin. 
*/
void stub_lv_image_set_offset_x(lv_obj_t * obj, int32_t x) {
    lv_image_set_offset_x(obj,x);
}

/*
Set an offset for the source of an image. so the image will be displayed from the new origin. 
*/
void stub_lv_image_set_offset_y(lv_obj_t * obj, int32_t y) {
    lv_image_set_offset_y(obj,y);
}

/*
Set the rotation angle of the image. The image will be rotated around the set pivot set by :ref:`lv_image_set_pivot()` Note that indexed and alpha only images can't be transformed. if image_align is LV_IMAGE_ALIGN_STRETCH or LV_IMAGE_ALIGN_FIT rotation will be set to 0 automatically. 
*/
void stub_lv_image_set_rotation(lv_obj_t * obj, int32_t angle) {
    lv_image_set_rotation(obj,angle);
}

/*
Set the rotation center of the image. The image will be rotated around this point. x, y can be set with value of LV_PCT, lv_image_get_pivot will return the true pixel coordinate of pivot in this case. 
*/
void stub_lv_image_set_pivot(lv_obj_t * obj, int32_t x, int32_t y) {
    lv_image_set_pivot(obj,x,y);
}

/*
Set the zoom factor of the image. Note that indexed and alpha only images can't be transformed. 
*/
void stub_lv_image_set_scale(lv_obj_t * obj, uint32_t zoom) {
    lv_image_set_scale(obj,zoom);
}

/*
Set the horizontal zoom factor of the image. Note that indexed and alpha only images can't be transformed. 
*/
void stub_lv_image_set_scale_x(lv_obj_t * obj, uint32_t zoom) {
    lv_image_set_scale_x(obj,zoom);
}

/*
Set the vertical zoom factor of the image. Note that indexed and alpha only images can't be transformed. 
*/
void stub_lv_image_set_scale_y(lv_obj_t * obj, uint32_t zoom) {
    lv_image_set_scale_y(obj,zoom);
}

/*
Set the blend mode of an image. 
*/
void stub_lv_image_set_blend_mode(lv_obj_t * obj, lv_blend_mode_t blend_mode) {
    lv_image_set_blend_mode(obj,blend_mode);
}

/*
Enable/disable anti-aliasing for the transformations (rotate, zoom) or not. The quality is better with anti-aliasing looks better but slower. 
*/
void stub_lv_image_set_antialias(lv_obj_t * obj, bool antialias) {
    lv_image_set_antialias(obj,antialias);
}

/*
Set the image object size mode. if image_align is LV_IMAGE_ALIGN_STRETCH or LV_IMAGE_ALIGN_FIT rotation, scale and pivot will be overwritten and controlled internally. 
*/
void stub_lv_image_set_inner_align(lv_obj_t * obj, lv_image_align_t align) {
    lv_image_set_inner_align(obj,align);
}

/*
Set an A8 bitmap mask for the image. 
*/
void stub_lv_image_set_bitmap_map_src(lv_obj_t * obj, lv_image_dsc_t * src) {
    lv_image_set_bitmap_map_src(obj,src);
}

/*
Get the source of the image the image source (symbol, file name or ::lv-img_dsc_t for C arrays) 
*/
void * stub_lv_image_get_src(lv_obj_t * obj) {
    return lv_image_get_src(obj);
}

/*
Get the offset's x attribute of the image object. offset X value. 
*/
int32_t stub_lv_image_get_offset_x(lv_obj_t * obj) {
    return lv_image_get_offset_x(obj);
}

/*
Get the offset's y attribute of the image object. offset Y value. 
*/
int32_t stub_lv_image_get_offset_y(lv_obj_t * obj) {
    return lv_image_get_offset_y(obj);
}

/*
Get the rotation of the image. rotation in 0.1 degrees (0..3600)  if image_align is LV_IMAGE_ALIGN_STRETCH or LV_IMAGE_ALIGN_FIT rotation will be set to 0 automatically. 
*/
int32_t stub_lv_image_get_rotation(lv_obj_t * obj) {
    return lv_image_get_rotation(obj);
}

/*
Get the pivot (rotation center) of the image. If pivot is set with LV_PCT, convert it to px before return. 
*/
void stub_lv_image_get_pivot(lv_obj_t * obj, lv_point_t * pivot) {
    lv_image_get_pivot(obj,pivot);
}

/*
Get the zoom factor of the image. zoom factor (256: no zoom) 
*/
int32_t stub_lv_image_get_scale(lv_obj_t * obj) {
    return lv_image_get_scale(obj);
}

/*
Get the horizontal zoom factor of the image. zoom factor (256: no zoom) 
*/
int32_t stub_lv_image_get_scale_x(lv_obj_t * obj) {
    return lv_image_get_scale_x(obj);
}

/*
Get the vertical zoom factor of the image. zoom factor (256: no zoom) 
*/
int32_t stub_lv_image_get_scale_y(lv_obj_t * obj) {
    return lv_image_get_scale_y(obj);
}

/*
Get the current blend mode of the image the current blend mode 
*/
lv_blend_mode_t stub_lv_image_get_blend_mode(lv_obj_t * obj) {
    return lv_image_get_blend_mode(obj);
}

/*
Get whether the transformations (rotate, zoom) are anti-aliased or not true: anti-aliased; false: not anti-aliased 
*/
bool stub_lv_image_get_antialias(lv_obj_t * obj) {
    return lv_image_get_antialias(obj);
}

/*
Get the size mode of the image element of lv_image_align_t 
*/
lv_image_align_t stub_lv_image_get_inner_align(lv_obj_t * obj) {
    return lv_image_get_inner_align(obj);
}

/*
Get the bitmap mask source. an :ref:`lv_image_dsc_t` bitmap mask source. 
*/
lv_image_dsc_t * stub_lv_image_get_bitmap_map_src(lv_obj_t * obj) {
    return lv_image_get_bitmap_map_src(obj);
}

/*
Create an animation image objects pointer to the created animation image object 
*/
lv_obj_t * stub_lv_animimg_create(lv_obj_t * parent) {
    return lv_animimg_create(parent);
}

/*
Set the image animation images source. 
*/
void stub_lv_animimg_set_src(lv_obj_t * img, void * dsc[], size_t num) {
    lv_animimg_set_src(img,dsc,num);
}

/*
Startup the image animation. 
*/
void stub_lv_animimg_start(lv_obj_t * obj) {
    lv_animimg_start(obj);
}

/*
Set the image animation duration time. unit:ms 
*/
void stub_lv_animimg_set_duration(lv_obj_t * img, uint32_t duration) {
    lv_animimg_set_duration(img,duration);
}

/*
Set the image animation repeatedly play times. 
*/
void stub_lv_animimg_set_repeat_count(lv_obj_t * img, uint32_t count) {
    lv_animimg_set_repeat_count(img,count);
}

/*
Get the image animation images source. a pointer that will point to a series images 
*/
void * * stub_lv_animimg_get_src(lv_obj_t * img) {
    return lv_animimg_get_src(img);
}

/*
Get the image animation images source. the number of source images 
*/
uint8_t stub_lv_animimg_get_src_count(lv_obj_t * img) {
    return lv_animimg_get_src_count(img);
}

/*
Get the image animation duration time. unit:ms the animation duration time 
*/
uint32_t stub_lv_animimg_get_duration(lv_obj_t * img) {
    return lv_animimg_get_duration(img);
}

/*
Get the image animation repeat play times. the repeat count 
*/
uint32_t stub_lv_animimg_get_repeat_count(lv_obj_t * img) {
    return lv_animimg_get_repeat_count(img);
}

/*
Get the image animation underlying animation. the animation reference 
*/
lv_anim_t * stub_lv_animimg_get_anim(lv_obj_t * img) {
    return lv_animimg_get_anim(img);
}

/*
Create an arc object pointer to the created arc 
*/
lv_obj_t * stub_lv_arc_create(lv_obj_t * parent) {
    return lv_arc_create(parent);
}

/*
Set the start angle of an arc. 0 deg: right, 90 bottom, etc. 
*/
void stub_lv_arc_set_start_angle(lv_obj_t * obj, lv_value_precise_t start) {
    lv_arc_set_start_angle(obj,start);
}

/*
Set the end angle of an arc. 0 deg: right, 90 bottom, etc. 
*/
void stub_lv_arc_set_end_angle(lv_obj_t * obj, lv_value_precise_t end) {
    lv_arc_set_end_angle(obj,end);
}

/*
Set the start and end angles 
*/
void stub_lv_arc_set_angles(lv_obj_t * obj, lv_value_precise_t start, lv_value_precise_t end) {
    lv_arc_set_angles(obj,start,end);
}

/*
Set the start angle of an arc background. 0 deg: right, 90 bottom, etc. 
*/
void stub_lv_arc_set_bg_start_angle(lv_obj_t * obj, lv_value_precise_t start) {
    lv_arc_set_bg_start_angle(obj,start);
}

/*
Set the start angle of an arc background. 0 deg: right, 90 bottom etc. 
*/
void stub_lv_arc_set_bg_end_angle(lv_obj_t * obj, lv_value_precise_t end) {
    lv_arc_set_bg_end_angle(obj,end);
}

/*
Set the start and end angles of the arc background 
*/
void stub_lv_arc_set_bg_angles(lv_obj_t * obj, lv_value_precise_t start, lv_value_precise_t end) {
    lv_arc_set_bg_angles(obj,start,end);
}

/*
Set the rotation for the whole arc 
*/
void stub_lv_arc_set_rotation(lv_obj_t * obj, int32_t rotation) {
    lv_arc_set_rotation(obj,rotation);
}

/*
Set the type of arc. 
*/
void stub_lv_arc_set_mode(lv_obj_t * obj, lv_arc_mode_t type) {
    lv_arc_set_mode(obj,type);
}

/*
Set a new value on the arc 
*/
void stub_lv_arc_set_value(lv_obj_t * obj, int32_t value) {
    lv_arc_set_value(obj,value);
}

/*
Set minimum and the maximum values of an arc 
*/
void stub_lv_arc_set_range(lv_obj_t * obj, int32_t min, int32_t max) {
    lv_arc_set_range(obj,min,max);
}

/*
Set a change rate to limit the speed how fast the arc should reach the pressed point. 
*/
void stub_lv_arc_set_change_rate(lv_obj_t * obj, uint32_t rate) {
    lv_arc_set_change_rate(obj,rate);
}

/*
Set an offset angle for the knob 
*/
void stub_lv_arc_set_knob_offset(lv_obj_t * obj, int32_t offset) {
    lv_arc_set_knob_offset(obj,offset);
}

/*
Get the start angle of an arc. the start angle [0..360] (if LV_USE_FLOAT is enabled it can be fractional too.) 
*/
lv_value_precise_t stub_lv_arc_get_angle_start(lv_obj_t * obj) {
    return lv_arc_get_angle_start(obj);
}

/*
Get the end angle of an arc. the end angle [0..360] (if LV_USE_FLOAT is enabled it can be fractional too.) 
*/
lv_value_precise_t stub_lv_arc_get_angle_end(lv_obj_t * obj) {
    return lv_arc_get_angle_end(obj);
}

/*
Get the start angle of an arc background. the start angle [0..360] (if LV_USE_FLOAT is enabled it can be fractional too.) 
*/
lv_value_precise_t stub_lv_arc_get_bg_angle_start(lv_obj_t * obj) {
    return lv_arc_get_bg_angle_start(obj);
}

/*
Get the end angle of an arc background. the end angle [0..360] (if LV_USE_FLOAT is enabled it can be fractional too.) 
*/
lv_value_precise_t stub_lv_arc_get_bg_angle_end(lv_obj_t * obj) {
    return lv_arc_get_bg_angle_end(obj);
}

/*
Get the value of an arc the value of the arc 
*/
int32_t stub_lv_arc_get_value(lv_obj_t * obj) {
    return lv_arc_get_value(obj);
}

/*
Get the minimum value of an arc the minimum value of the arc 
*/
int32_t stub_lv_arc_get_min_value(lv_obj_t * obj) {
    return lv_arc_get_min_value(obj);
}

/*
Get the maximum value of an arc the maximum value of the arc 
*/
int32_t stub_lv_arc_get_max_value(lv_obj_t * obj) {
    return lv_arc_get_max_value(obj);
}

/*
Get whether the arc is type or not. arc's mode 
*/
lv_arc_mode_t stub_lv_arc_get_mode(lv_obj_t * obj) {
    return lv_arc_get_mode(obj);
}

/*
Get the rotation for the whole arc arc's current rotation 
*/
int32_t stub_lv_arc_get_rotation(lv_obj_t * obj) {
    return lv_arc_get_rotation(obj);
}

/*
Get the current knob angle offset arc's current knob offset 
*/
int32_t stub_lv_arc_get_knob_offset(lv_obj_t * obj) {
    return lv_arc_get_knob_offset(obj);
}

/*
Align an object to the current position of the arc (knob) 
*/
void stub_lv_arc_align_obj_to_angle(lv_obj_t * obj, lv_obj_t * obj_to_align, int32_t r_offset) {
    lv_arc_align_obj_to_angle(obj,obj_to_align,r_offset);
}

/*
Rotate an object to the current position of the arc (knob) 
*/
void stub_lv_arc_rotate_obj_to_angle(lv_obj_t * obj, lv_obj_t * obj_to_rotate, int32_t r_offset) {
    lv_arc_rotate_obj_to_angle(obj,obj_to_rotate,r_offset);
}

/*
Create a label object pointer to the created button 
*/
lv_obj_t * stub_lv_label_create(lv_obj_t * parent) {
    return lv_label_create(parent);
}

/*
Set a new text for a label. Memory will be allocated to store the text by the label. 
*/
void stub_lv_label_set_text(lv_obj_t * obj, char * text) {
    lv_label_set_text(obj,text);
}

/*
Set a new formatted text for a label. Memory will be allocated to store the text by the label. lv_label_set_text_fmt(label1, "%d user", user_num); 
*/
void stub_lv_label_set_text_fmt(lv_obj_t * obj, char * fmt, ... ...) {
    lv_label_set_text_fmt(obj,fmt,...);
}

/*
Set a static text. It will not be saved by the label so the 'text' variable has to be 'alive' while the label exists. 
*/
void stub_lv_label_set_text_static(lv_obj_t * obj, char * text) {
    lv_label_set_text_static(obj,text);
}

/*
Set the behavior of the label with text longer than the object size 
*/
void stub_lv_label_set_long_mode(lv_obj_t * obj, lv_label_long_mode_t long_mode) {
    lv_label_set_long_mode(obj,long_mode);
}

/*
Set where text selection should start 
*/
void stub_lv_label_set_text_selection_start(lv_obj_t * obj, uint32_t index) {
    lv_label_set_text_selection_start(obj,index);
}

/*
Set where text selection should end 
*/
void stub_lv_label_set_text_selection_end(lv_obj_t * obj, uint32_t index) {
    lv_label_set_text_selection_end(obj,index);
}

/*
Get the text of a label the text of the label 
*/
char * stub_lv_label_get_text(lv_obj_t * obj) {
    return lv_label_get_text(obj);
}

/*
Get the long mode of a label the current long mode 
*/
lv_label_long_mode_t stub_lv_label_get_long_mode(lv_obj_t * obj) {
    return lv_label_get_long_mode(obj);
}

/*
Get the relative x and y coordinates of a letter 
*/
void stub_lv_label_get_letter_pos(lv_obj_t * obj, uint32_t char_id, lv_point_t * pos) {
    lv_label_get_letter_pos(obj,char_id,pos);
}

/*
Get the index of letter on a relative point of a label. The index of the letter on the 'pos_p' point (E.g. on 0;0 is the 0. letter if aligned to the left) Expressed in character index and not byte index (different in UTF-8) 
*/
uint32_t stub_lv_label_get_letter_on(lv_obj_t * obj, lv_point_t * pos_in, bool bidi) {
    return lv_label_get_letter_on(obj,pos_in,bidi);
}

/*
Check if a character is drawn under a point. whether a character is drawn under the point 
*/
bool stub_lv_label_is_char_under_pos(lv_obj_t * obj, lv_point_t * pos) {
    return lv_label_is_char_under_pos(obj,pos);
}

/*
selection start index. LV_LABEL_TEXT_SELECTION_OFF if nothing is selected. 
*/
uint32_t stub_lv_label_get_text_selection_start(lv_obj_t * obj) {
    return lv_label_get_text_selection_start(obj);
}

/*
selection end index. LV_LABEL_TXT_SEL_OFF if nothing is selected. 
*/
uint32_t stub_lv_label_get_text_selection_end(lv_obj_t * obj) {
    return lv_label_get_text_selection_end(obj);
}

/*
Insert a text to a label. The label text cannot be static. 
*/
void stub_lv_label_ins_text(lv_obj_t * obj, uint32_t pos, char * txt) {
    lv_label_ins_text(obj,pos,txt);
}

/*
Delete characters from a label. The label text cannot be static. 
*/
void stub_lv_label_cut_text(lv_obj_t * obj, uint32_t pos, uint32_t cnt) {
    lv_label_cut_text(obj,pos,cnt);
}

/*
Create a bar object pointer to the created bar 
*/
lv_obj_t * stub_lv_bar_create(lv_obj_t * parent) {
    return lv_bar_create(parent);
}

/*
Set a new value on the bar 
*/
void stub_lv_bar_set_value(lv_obj_t * obj, int32_t value, lv_anim_enable_t anim) {
    lv_bar_set_value(obj,value,anim);
}

/*
Set a new start value on the bar 
*/
void stub_lv_bar_set_start_value(lv_obj_t * obj, int32_t start_value, lv_anim_enable_t anim) {
    lv_bar_set_start_value(obj,start_value,anim);
}

/*
Set minimum and the maximum values of a bar If min is greater than max, the drawing direction becomes to the opposite direction. 
*/
void stub_lv_bar_set_range(lv_obj_t * obj, int32_t min, int32_t max) {
    lv_bar_set_range(obj,min,max);
}

/*
Set the type of bar. 
*/
void stub_lv_bar_set_mode(lv_obj_t * obj, lv_bar_mode_t mode) {
    lv_bar_set_mode(obj,mode);
}

/*
Set the orientation of bar. 
*/
void stub_lv_bar_set_orientation(lv_obj_t * obj, lv_bar_orientation_t orientation) {
    lv_bar_set_orientation(obj,orientation);
}

/*
Get the value of a bar the value of the bar 
*/
int32_t stub_lv_bar_get_value(lv_obj_t * obj) {
    return lv_bar_get_value(obj);
}

/*
Get the start value of a bar the start value of the bar 
*/
int32_t stub_lv_bar_get_start_value(lv_obj_t * obj) {
    return lv_bar_get_start_value(obj);
}

/*
Get the minimum value of a bar the minimum value of the bar 
*/
int32_t stub_lv_bar_get_min_value(lv_obj_t * obj) {
    return lv_bar_get_min_value(obj);
}

/*
Get the maximum value of a bar the maximum value of the bar 
*/
int32_t stub_lv_bar_get_max_value(lv_obj_t * obj) {
    return lv_bar_get_max_value(obj);
}

/*
Get the type of bar. bar type from lv_bar_mode_t 
*/
lv_bar_mode_t stub_lv_bar_get_mode(lv_obj_t * obj) {
    return lv_bar_get_mode(obj);
}

/*
Get the orientation of bar. bar orientation from lv_bar_orientation_t 
*/
lv_bar_orientation_t stub_lv_bar_get_orientation(lv_obj_t * obj) {
    return lv_bar_get_orientation(obj);
}

/*
Give the bar is in symmetrical mode or not true: in symmetrical mode false : not in 
*/
bool stub_lv_bar_is_symmetrical(lv_obj_t * obj) {
    return lv_bar_is_symmetrical(obj);
}

/*
Create a button object pointer to the created button 
*/
lv_obj_t * stub_lv_button_create(lv_obj_t * parent) {
    return lv_button_create(parent);
}

/*
Create a button matrix object pointer to the created button matrix 
*/
lv_obj_t * stub_lv_buttonmatrix_create(lv_obj_t * parent) {
    return lv_buttonmatrix_create(parent);
}

/*
Set a new map. Buttons will be created/deleted according to the map. The button matrix keeps a reference to the map and so the string array must not be deallocated during the life of the matrix. 
*/
void stub_lv_buttonmatrix_set_map(lv_obj_t * obj, char * map[]) {
    lv_buttonmatrix_set_map(obj,map);
}

/*
Set the button control map (hidden, disabled etc.) for a button matrix. The control map array will be copied and so may be deallocated after this function returns. 
*/
void stub_lv_buttonmatrix_set_ctrl_map(lv_obj_t * obj, lv_buttonmatrix_ctrl_t ctrl_map[]) {
    lv_buttonmatrix_set_ctrl_map(obj,ctrl_map);
}

/*
Set the selected buttons 
*/
void stub_lv_buttonmatrix_set_selected_button(lv_obj_t * obj, uint32_t btn_id) {
    lv_buttonmatrix_set_selected_button(obj,btn_id);
}

/*
Set the attributes of a button of the button matrix 
*/
void stub_lv_buttonmatrix_set_button_ctrl(lv_obj_t * obj, uint32_t btn_id, lv_buttonmatrix_ctrl_t ctrl) {
    lv_buttonmatrix_set_button_ctrl(obj,btn_id,ctrl);
}

/*
Clear the attributes of a button of the button matrix 
*/
void stub_lv_buttonmatrix_clear_button_ctrl(lv_obj_t * obj, uint32_t btn_id, lv_buttonmatrix_ctrl_t ctrl) {
    lv_buttonmatrix_clear_button_ctrl(obj,btn_id,ctrl);
}

/*
Set attributes of all buttons of a button matrix 
*/
void stub_lv_buttonmatrix_set_button_ctrl_all(lv_obj_t * obj, lv_buttonmatrix_ctrl_t ctrl) {
    lv_buttonmatrix_set_button_ctrl_all(obj,ctrl);
}

/*
Clear the attributes of all buttons of a button matrix 
*/
void stub_lv_buttonmatrix_clear_button_ctrl_all(lv_obj_t * obj, lv_buttonmatrix_ctrl_t ctrl) {
    lv_buttonmatrix_clear_button_ctrl_all(obj,ctrl);
}

/*
Set a single button's relative width. This method will cause the matrix be regenerated and is a relatively expensive operation. It is recommended that initial width be specified using lv_buttonmatrix_set_ctrl_map and this method only be used for dynamic changes. 
*/
void stub_lv_buttonmatrix_set_button_width(lv_obj_t * obj, uint32_t btn_id, uint32_t width) {
    lv_buttonmatrix_set_button_width(obj,btn_id,width);
}

/*
Make the button matrix like a selector widget (only one button may be checked at a time). LV_BUTTONMATRIX_CTRL_CHECKABLE must be enabled on the buttons to be selected using lv_buttonmatrix_set_ctrl() or :ref:`lv_buttonmatrix_set_button_ctrl_all()` . 
*/
void stub_lv_buttonmatrix_set_one_checked(lv_obj_t * obj, bool en) {
    lv_buttonmatrix_set_one_checked(obj,en);
}

/*
Get the current map of a button matrix the current map 
*/
char * * stub_lv_buttonmatrix_get_map(lv_obj_t * obj) {
    return lv_buttonmatrix_get_map(obj);
}

/*
Get the index of the lastly "activated" button by the user (pressed, released, focused etc) Useful in the event_cb to get the text of the button, check if hidden etc. index of the last released button (LV_BUTTONMATRIX_BUTTON_NONE: if unset) 
*/
uint32_t stub_lv_buttonmatrix_get_selected_button(lv_obj_t * obj) {
    return lv_buttonmatrix_get_selected_button(obj);
}

/*
Get the button's text text of btn_index` button 
*/
char * stub_lv_buttonmatrix_get_button_text(lv_obj_t * obj, uint32_t btn_id) {
    return lv_buttonmatrix_get_button_text(obj,btn_id);
}

/*
Get the whether a control value is enabled or disabled for button of a button matrix true: the control attribute is enabled false: disabled 
*/
bool stub_lv_buttonmatrix_has_button_ctrl(lv_obj_t * obj, uint32_t btn_id, lv_buttonmatrix_ctrl_t ctrl) {
    return lv_buttonmatrix_has_button_ctrl(obj,btn_id,ctrl);
}

/*
Tell whether "one check" mode is enabled or not. true: "one check" mode is enabled; false: disabled 
*/
bool stub_lv_buttonmatrix_get_one_checked(lv_obj_t * obj) {
    return lv_buttonmatrix_get_one_checked(obj);
}

/*
Create a calendar widget pointer the created calendar 
*/
lv_obj_t * stub_lv_calendar_create(lv_obj_t * parent) {
    return lv_calendar_create(parent);
}

/*
Set the today's date 
*/
void stub_lv_calendar_set_today_date(lv_obj_t * obj, uint32_t year, uint32_t month, uint32_t day) {
    lv_calendar_set_today_date(obj,year,month,day);
}

/*
Set the currently showed 
*/
void stub_lv_calendar_set_showed_date(lv_obj_t * obj, uint32_t year, uint32_t month) {
    lv_calendar_set_showed_date(obj,year,month);
}

/*
Set the highlighted dates 
*/
void stub_lv_calendar_set_highlighted_dates(lv_obj_t * obj, lv_calendar_date_t highlighted[], size_t date_num) {
    lv_calendar_set_highlighted_dates(obj,highlighted,date_num);
}

/*
Set the name of the days 
*/
void stub_lv_calendar_set_day_names(lv_obj_t * obj, char * * day_names) {
    lv_calendar_set_day_names(obj,day_names);
}

/*
Get the button matrix object of the calendar. It shows the dates and day names. pointer to a the button matrix 
*/
lv_obj_t * stub_lv_calendar_get_btnmatrix(lv_obj_t * obj) {
    return lv_calendar_get_btnmatrix(obj);
}

/*
Get the today's date return pointer to an :ref:`lv_calendar_date_t` variable containing the date of today. 
*/
lv_calendar_date_t * stub_lv_calendar_get_today_date(lv_obj_t * calendar) {
    return lv_calendar_get_today_date(calendar);
}

/*
Get the currently showed pointer to an :ref:`lv_calendar_date_t` variable containing the date is being shown. 
*/
lv_calendar_date_t * stub_lv_calendar_get_showed_date(lv_obj_t * calendar) {
    return lv_calendar_get_showed_date(calendar);
}

/*
Get the highlighted dates pointer to an :ref:`lv_calendar_date_t` array containing the dates. 
*/
lv_calendar_date_t * stub_lv_calendar_get_highlighted_dates(lv_obj_t * calendar) {
    return lv_calendar_get_highlighted_dates(calendar);
}

/*
Get the number of the highlighted dates number of highlighted days 
*/
size_t stub_lv_calendar_get_highlighted_dates_num(lv_obj_t * calendar) {
    return lv_calendar_get_highlighted_dates_num(calendar);
}

/*
Get the currently pressed day LV_RESULT_OK: there is a valid pressed date LV_RESULT_INVALID: there is no pressed data 
*/
lv_result_t stub_lv_calendar_get_pressed_date(lv_obj_t * calendar, lv_calendar_date_t * date) {
    return lv_calendar_get_pressed_date(calendar,date);
}

/*
Create a calendar header with drop-drowns to select the year and month the created header 
*/
lv_obj_t * stub_lv_calendar_header_arrow_create(lv_obj_t * parent) {
    return lv_calendar_header_arrow_create(parent);
}

/*
Create a calendar header with drop-drowns to select the year and month the created header 
*/
lv_obj_t * stub_lv_calendar_header_dropdown_create(lv_obj_t * parent) {
    return lv_calendar_header_dropdown_create(parent);
}

/*
Sets a custom calendar year list 
*/
void stub_lv_calendar_header_dropdown_set_year_list(lv_obj_t * parent, char * years_list) {
    lv_calendar_header_dropdown_set_year_list(parent,years_list);
}

/*
Create a canvas object pointer to the created canvas 
*/
lv_obj_t * stub_lv_canvas_create(lv_obj_t * parent) {
    return lv_canvas_create(parent);
}

/*
Set a buffer for the canvas. 

Use :ref:`lv_canvas_set_draw_buf()` instead if you need to set a buffer with alignment requirement.  
*/
void stub_lv_canvas_set_buffer(lv_obj_t * obj, void * buf, int32_t w, int32_t h, lv_color_format_t cf) {
    lv_canvas_set_buffer(obj,buf,w,h,cf);
}

/*
Set a draw buffer for the canvas. A draw buffer either can be allocated by :ref:`lv_draw_buf_create()` or defined statically by LV_DRAW_BUF_DEFINE_STATIC . When buffer start address and stride has alignment requirement, it's recommended to use lv_draw_buf_create . 
*/
void stub_lv_canvas_set_draw_buf(lv_obj_t * obj, lv_draw_buf_t * draw_buf) {
    lv_canvas_set_draw_buf(obj,draw_buf);
}

/*
Set a pixel's color and opacity The following color formats are supported LV_COLOR_FORMAT_I1/2/4/8, LV_COLOR_FORMAT_A8, LV_COLOR_FORMAT_RGB565, LV_COLOR_FORMAT_RGB888, LV_COLOR_FORMAT_XRGB8888, LV_COLOR_FORMAT_ARGB8888 
*/
void stub_lv_canvas_set_px(lv_obj_t * obj, int32_t x, int32_t y, lv_color_t color, lv_opa_t opa) {
    lv_canvas_set_px(obj,x,y,color,opa);
}

/*
Set the palette color of a canvas for index format. Valid only for LV_COLOR_FORMAT_I1/2/4/8 
*/
void stub_lv_canvas_set_palette(lv_obj_t * obj, uint8_t index, lv_color32_t color) {
    lv_canvas_set_palette(obj,index,color);
}

lv_draw_buf_t * stub_lv_canvas_get_draw_buf(lv_obj_t * obj) {
    return lv_canvas_get_draw_buf(obj);
}

/*
Get a pixel's color and opacity ARGB8888 color of the pixel 
*/
lv_color32_t stub_lv_canvas_get_px(lv_obj_t * obj, int32_t x, int32_t y) {
    return lv_canvas_get_px(obj,x,y);
}

/*
Get the image of the canvas as a pointer to an :ref:`lv_image_dsc_t` variable. pointer to the image descriptor. 
*/
lv_image_dsc_t * stub_lv_canvas_get_image(lv_obj_t * canvas) {
    return lv_canvas_get_image(canvas);
}

/*
Return the pointer for the buffer. It's recommended to use this function instead of the buffer form the return value of :ref:`lv_canvas_get_image()` as is can be aligned pointer to the buffer 
*/
void * stub_lv_canvas_get_buf(lv_obj_t * canvas) {
    return lv_canvas_get_buf(canvas);
}

/*
Copy a buffer to the canvas 
*/
void stub_lv_canvas_copy_buf(lv_obj_t * obj, lv_area_t * canvas_area, lv_draw_buf_t * dest_buf, lv_area_t * dest_area) {
    lv_canvas_copy_buf(obj,canvas_area,dest_buf,dest_area);
}

/*
Fill the canvas with color 
*/
void stub_lv_canvas_fill_bg(lv_obj_t * obj, lv_color_t color, lv_opa_t opa) {
    lv_canvas_fill_bg(obj,color,opa);
}

/*
Initialize a layer to use LVGL's generic draw functions (lv_draw_rect/label/...) on the canvas. Needs to be usd in pair with lv_canvas_finish_layer . 
*/
void stub_lv_canvas_init_layer(lv_obj_t * canvas, lv_layer_t * layer) {
    lv_canvas_init_layer(canvas,layer);
}

/*
Wait until all the drawings are finished on layer. Needs to be usd in pair with lv_canvas_init_layer . 
*/
void stub_lv_canvas_finish_layer(lv_obj_t * canvas, lv_layer_t * layer) {
    lv_canvas_finish_layer(canvas,layer);
}

/*
Just a wrapper to LV_CANVAS_BUF_SIZE for bindings. 
*/
uint32_t stub_lv_canvas_buf_size(int32_t w, int32_t h, uint8_t bpp, uint8_t stride) {
    return lv_canvas_buf_size(w,h,bpp,stride);
}

/*
Create a chart object pointer to the created chart 
*/
lv_obj_t * stub_lv_chart_create(lv_obj_t * parent) {
    return lv_chart_create(parent);
}

/*
Set a new type for a chart 
*/
void stub_lv_chart_set_type(lv_obj_t * obj, lv_chart_type_t type) {
    lv_chart_set_type(obj,type);
}

/*
Set the number of points on a data line on a chart 
*/
void stub_lv_chart_set_point_count(lv_obj_t * obj, uint32_t cnt) {
    lv_chart_set_point_count(obj,cnt);
}

/*
Set the minimal and maximal y values on an axis 
*/
void stub_lv_chart_set_range(lv_obj_t * obj, lv_chart_axis_t axis, int32_t min, int32_t max) {
    lv_chart_set_range(obj,axis,min,max);
}

/*
Set update mode of the chart object. Affects 
*/
void stub_lv_chart_set_update_mode(lv_obj_t * obj, lv_chart_update_mode_t update_mode) {
    lv_chart_set_update_mode(obj,update_mode);
}

/*
Set the number of horizontal and vertical division lines 
*/
void stub_lv_chart_set_div_line_count(lv_obj_t * obj, uint8_t hdiv, uint8_t vdiv) {
    lv_chart_set_div_line_count(obj,hdiv,vdiv);
}

/*
Get the type of a chart type of the chart (from 'lv_chart_t' enum) 
*/
lv_chart_type_t stub_lv_chart_get_type(lv_obj_t * obj) {
    return lv_chart_get_type(obj);
}

/*
Get the data point number per data line on chart point number on each data line 
*/
uint32_t stub_lv_chart_get_point_count(lv_obj_t * obj) {
    return lv_chart_get_point_count(obj);
}

/*
Get the current index of the x-axis start point in the data array the index of the current x start point in the data array 
*/
uint32_t stub_lv_chart_get_x_start_point(lv_obj_t * obj, lv_chart_series_t * ser) {
    return lv_chart_get_x_start_point(obj,ser);
}

/*
Get the position of a point to the chart. 
*/
void stub_lv_chart_get_point_pos_by_id(lv_obj_t * obj, lv_chart_series_t * ser, uint32_t id, lv_point_t * p_out) {
    lv_chart_get_point_pos_by_id(obj,ser,id,p_out);
}

/*
Refresh a chart if its data line has changed 
*/
void stub_lv_chart_refresh(lv_obj_t * obj) {
    lv_chart_refresh(obj);
}

/*
Allocate and add a data series to the chart pointer to the allocated data series or NULL on failure 
*/
lv_chart_series_t * stub_lv_chart_add_series(lv_obj_t * obj, lv_color_t color, lv_chart_axis_t axis) {
    return lv_chart_add_series(obj,color,axis);
}

/*
Deallocate and remove a data series from a chart 
*/
void stub_lv_chart_remove_series(lv_obj_t * obj, lv_chart_series_t * series) {
    lv_chart_remove_series(obj,series);
}

/*
Hide/Unhide a single series of a chart. 
*/
void stub_lv_chart_hide_series(lv_obj_t * chart, lv_chart_series_t * series, bool hide) {
    lv_chart_hide_series(chart,series,hide);
}

/*
Change the color of a series 
*/
void stub_lv_chart_set_series_color(lv_obj_t * chart, lv_chart_series_t * series, lv_color_t color) {
    lv_chart_set_series_color(chart,series,color);
}

/*
Get the color of a series the color of the series 
*/
lv_color_t stub_lv_chart_get_series_color(lv_obj_t * chart, lv_chart_series_t * series) {
    return lv_chart_get_series_color(chart,series);
}

/*
Set the index of the x-axis start point in the data array. This point will be considers the first (left) point and the other points will be drawn after it. 
*/
void stub_lv_chart_set_x_start_point(lv_obj_t * obj, lv_chart_series_t * ser, uint32_t id) {
    lv_chart_set_x_start_point(obj,ser,id);
}

/*
Get the next series. the next series or NULL if there is no more. 
*/
lv_chart_series_t * stub_lv_chart_get_series_next(lv_obj_t * chart, lv_chart_series_t * ser) {
    return lv_chart_get_series_next(chart,ser);
}

/*
Add a cursor with a given color pointer to the created cursor 
*/
lv_chart_cursor_t * stub_lv_chart_add_cursor(lv_obj_t * obj, lv_color_t color, lv_dir_t dir) {
    return lv_chart_add_cursor(obj,color,dir);
}

/*
Set the coordinate of the cursor with respect to the paddings 
*/
void stub_lv_chart_set_cursor_pos(lv_obj_t * chart, lv_chart_cursor_t * cursor, lv_point_t * pos) {
    lv_chart_set_cursor_pos(chart,cursor,pos);
}

/*
Stick the cursor to a point 
*/
void stub_lv_chart_set_cursor_point(lv_obj_t * chart, lv_chart_cursor_t * cursor, lv_chart_series_t * ser, uint32_t point_id) {
    lv_chart_set_cursor_point(chart,cursor,ser,point_id);
}

/*
Get the coordinate of the cursor with respect to the paddings coordinate of the cursor as :ref:`lv_point_t` 
*/
lv_point_t stub_lv_chart_get_cursor_point(lv_obj_t * chart, lv_chart_cursor_t * cursor) {
    return lv_chart_get_cursor_point(chart,cursor);
}

/*
Initialize all data points of a series with a value 
*/
void stub_lv_chart_set_all_value(lv_obj_t * obj, lv_chart_series_t * ser, int32_t value) {
    lv_chart_set_all_value(obj,ser,value);
}

/*
Set the next point's Y value according to the update mode policy. 
*/
void stub_lv_chart_set_next_value(lv_obj_t * obj, lv_chart_series_t * ser, int32_t value) {
    lv_chart_set_next_value(obj,ser,value);
}

/*
Set the next point's X and Y value according to the update mode policy. 
*/
void stub_lv_chart_set_next_value2(lv_obj_t * obj, lv_chart_series_t * ser, int32_t x_value, int32_t y_value) {
    lv_chart_set_next_value2(obj,ser,x_value,y_value);
}

/*
Set an individual point's y value of a chart's series directly based on its index 
*/
void stub_lv_chart_set_value_by_id(lv_obj_t * obj, lv_chart_series_t * ser, uint32_t id, int32_t value) {
    lv_chart_set_value_by_id(obj,ser,id,value);
}

/*
Set an individual point's x and y value of a chart's series directly based on its index Can be used only with LV_CHART_TYPE_SCATTER . 
*/
void stub_lv_chart_set_value_by_id2(lv_obj_t * obj, lv_chart_series_t * ser, uint32_t id, int32_t x_value, int32_t y_value) {
    lv_chart_set_value_by_id2(obj,ser,id,x_value,y_value);
}

/*
Set an external array for the y data points to use for the chart NOTE: It is the users responsibility to make sure the point_cnt matches the external array size. 
*/
void stub_lv_chart_set_ext_y_array(lv_obj_t * obj, lv_chart_series_t * ser, int32_t array[]) {
    lv_chart_set_ext_y_array(obj,ser,array);
}

/*
Set an external array for the x data points to use for the chart NOTE: It is the users responsibility to make sure the point_cnt matches the external array size. 
*/
void stub_lv_chart_set_ext_x_array(lv_obj_t * obj, lv_chart_series_t * ser, int32_t array[]) {
    lv_chart_set_ext_x_array(obj,ser,array);
}

/*
Get the array of y values of a series the array of values with 'point_count' elements 
*/
int32_t * stub_lv_chart_get_y_array(lv_obj_t * obj, lv_chart_series_t * ser) {
    return lv_chart_get_y_array(obj,ser);
}

/*
Get the array of x values of a series the array of values with 'point_count' elements 
*/
int32_t * stub_lv_chart_get_x_array(lv_obj_t * obj, lv_chart_series_t * ser) {
    return lv_chart_get_x_array(obj,ser);
}

/*
Get the index of the currently pressed point. It's the same for every series. the index of the point [0 .. point count] or LV_CHART_POINT_ID_NONE if no point is being pressed 
*/
uint32_t stub_lv_chart_get_pressed_point(lv_obj_t * obj) {
    return lv_chart_get_pressed_point(obj);
}

/*
Get the overall offset from the chart's side to the center of the first point. In case of a bar chart it will be the center of the first column group the offset of the center 
*/
int32_t stub_lv_chart_get_first_point_center_offset(lv_obj_t * obj) {
    return lv_chart_get_first_point_center_offset(obj);
}

/*
Create a check box object pointer to the created check box 
*/
lv_obj_t * stub_lv_checkbox_create(lv_obj_t * parent) {
    return lv_checkbox_create(parent);
}

/*
Set the text of a check box. txt will be copied and may be deallocated after this function returns. 
*/
void stub_lv_checkbox_set_text(lv_obj_t * obj, char * txt) {
    lv_checkbox_set_text(obj,txt);
}

/*
Set the text of a check box. txt must not be deallocated during the life of this checkbox. 
*/
void stub_lv_checkbox_set_text_static(lv_obj_t * obj, char * txt) {
    lv_checkbox_set_text_static(obj,txt);
}

/*
Get the text of a check box pointer to the text of the check box 
*/
char * stub_lv_checkbox_get_text(lv_obj_t * obj) {
    return lv_checkbox_get_text(obj);
}

/*
Create a drop-down list object pointer to the created drop-down list 
*/
lv_obj_t * stub_lv_dropdown_create(lv_obj_t * parent) {
    return lv_dropdown_create(parent);
}

/*
Set text of the drop-down list's button. If set to NULL the selected option's text will be displayed on the button. If set to a specific text then that text will be shown regardless of the selected option. 
*/
void stub_lv_dropdown_set_text(lv_obj_t * obj, char * txt) {
    lv_dropdown_set_text(obj,txt);
}

/*
Set the options in a drop-down list from a string. The options will be copied and saved in the object so the options can be destroyed after calling this function 
*/
void stub_lv_dropdown_set_options(lv_obj_t * obj, char * options) {
    lv_dropdown_set_options(obj,options);
}

/*
Set the options in a drop-down list from a static string (global, static or dynamically allocated). Only the pointer of the option string will be saved. 
*/
void stub_lv_dropdown_set_options_static(lv_obj_t * obj, char * options) {
    lv_dropdown_set_options_static(obj,options);
}

/*
Add an options to a drop-down list from a string. Only works for non-static options. 
*/
void stub_lv_dropdown_add_option(lv_obj_t * obj, char * option, uint32_t pos) {
    lv_dropdown_add_option(obj,option,pos);
}

/*
Clear all options in a drop-down list. Works with both static and dynamic options. 
*/
void stub_lv_dropdown_clear_options(lv_obj_t * obj) {
    lv_dropdown_clear_options(obj);
}

/*
Set the selected option 
*/
void stub_lv_dropdown_set_selected(lv_obj_t * obj, uint32_t sel_opt) {
    lv_dropdown_set_selected(obj,sel_opt);
}

/*
Set the direction of the a drop-down list 
*/
void stub_lv_dropdown_set_dir(lv_obj_t * obj, lv_dir_t dir) {
    lv_dropdown_set_dir(obj,dir);
}

/*
Set an arrow or other symbol to display when on drop-down list's button. Typically a down caret or arrow. angle and zoom transformation can be applied if the symbol is an image. E.g. when drop down is checked (opened) rotate the symbol by 180 degree 
*/
void stub_lv_dropdown_set_symbol(lv_obj_t * obj, void * symbol) {
    lv_dropdown_set_symbol(obj,symbol);
}

/*
Set whether the selected option in the list should be highlighted or not 
*/
void stub_lv_dropdown_set_selected_highlight(lv_obj_t * obj, bool en) {
    lv_dropdown_set_selected_highlight(obj,en);
}

/*
Get the list of a drop-down to allow styling or other modifications pointer to the list of the drop-down 
*/
lv_obj_t * stub_lv_dropdown_get_list(lv_obj_t * obj) {
    return lv_dropdown_get_list(obj);
}

/*
Get text of the drop-down list's button. the text as string, NULL if no text 
*/
char * stub_lv_dropdown_get_text(lv_obj_t * obj) {
    return lv_dropdown_get_text(obj);
}

/*
Get the options of a drop-down list the options separated by ' '-s (E.g. "Option1\nOption2\nOption3") 
*/
char * stub_lv_dropdown_get_options(lv_obj_t * obj) {
    return lv_dropdown_get_options(obj);
}

/*
Get the index of the selected option index of the selected option (0 ... number of option - 1); 
*/
uint32_t stub_lv_dropdown_get_selected(lv_obj_t * obj) {
    return lv_dropdown_get_selected(obj);
}

/*
Get the total number of options the total number of options in the list 
*/
uint32_t stub_lv_dropdown_get_option_count(lv_obj_t * obj) {
    return lv_dropdown_get_option_count(obj);
}

/*
Get the current selected option as a string 
*/
void stub_lv_dropdown_get_selected_str(lv_obj_t * obj, char * buf, uint32_t buf_size) {
    lv_dropdown_get_selected_str(obj,buf,buf_size);
}

/*
Get the index of an option. index of option in the list of all options. -1 if not found. 
*/
int32_t stub_lv_dropdown_get_option_index(lv_obj_t * obj, char * option) {
    return lv_dropdown_get_option_index(obj,option);
}

/*
Get the symbol on the drop-down list. Typically a down caret or arrow. the symbol or NULL if not enabled 
*/
char * stub_lv_dropdown_get_symbol(lv_obj_t * obj) {
    return lv_dropdown_get_symbol(obj);
}

/*
Get whether the selected option in the list should be highlighted or not true: highlight enabled; false: disabled 
*/
bool stub_lv_dropdown_get_selected_highlight(lv_obj_t * obj) {
    return lv_dropdown_get_selected_highlight(obj);
}

/*
Get the direction of the drop-down list LV_DIR_LEF/RIGHT/TOP/BOTTOM 
*/
lv_dir_t stub_lv_dropdown_get_dir(lv_obj_t * obj) {
    return lv_dropdown_get_dir(obj);
}

/*
Open the drop.down list 
*/
void stub_lv_dropdown_open(lv_obj_t * dropdown_obj) {
    lv_dropdown_open(dropdown_obj);
}

/*
Close (Collapse) the drop-down list 
*/
void stub_lv_dropdown_close(lv_obj_t * obj) {
    lv_dropdown_close(obj);
}

/*
Tells whether the list is opened or not true if the list os opened 
*/
bool stub_lv_dropdown_is_open(lv_obj_t * obj) {
    return lv_dropdown_is_open(obj);
}

/*
Create an image button object pointer to the created image button 
*/
lv_obj_t * stub_lv_imagebutton_create(lv_obj_t * parent) {
    return lv_imagebutton_create(parent);
}

/*
Set images for a state of the image button 
*/
void stub_lv_imagebutton_set_src(lv_obj_t * imagebutton, lv_imagebutton_state_t state, void * src_left, void * src_mid, void * src_right) {
    lv_imagebutton_set_src(imagebutton,state,src_left,src_mid,src_right);
}

/*
Use this function instead of lv_obj_add/remove_state to set a state manually 
*/
void stub_lv_imagebutton_set_state(lv_obj_t * imagebutton, lv_imagebutton_state_t state) {
    lv_imagebutton_set_state(imagebutton,state);
}

/*
Get the left image in a given state pointer to the left image source (a C array or path to a file) 
*/
void * stub_lv_imagebutton_get_src_left(lv_obj_t * imagebutton, lv_imagebutton_state_t state) {
    return lv_imagebutton_get_src_left(imagebutton,state);
}

/*
Get the middle image in a given state pointer to the middle image source (a C array or path to a file) 
*/
void * stub_lv_imagebutton_get_src_middle(lv_obj_t * imagebutton, lv_imagebutton_state_t state) {
    return lv_imagebutton_get_src_middle(imagebutton,state);
}

/*
Get the right image in a given state pointer to the left image source (a C array or path to a file) 
*/
void * stub_lv_imagebutton_get_src_right(lv_obj_t * imagebutton, lv_imagebutton_state_t state) {
    return lv_imagebutton_get_src_right(imagebutton,state);
}

/*
Create a Keyboard object pointer to the created keyboard 
*/
lv_obj_t * stub_lv_keyboard_create(lv_obj_t * parent) {
    return lv_keyboard_create(parent);
}

/*
Assign a Text Area to the Keyboard. The pressed characters will be put there. 
*/
void stub_lv_keyboard_set_textarea(lv_obj_t * kb, lv_obj_t * ta) {
    lv_keyboard_set_textarea(kb,ta);
}

/*
Set a new a mode (text or number map) 
*/
void stub_lv_keyboard_set_mode(lv_obj_t * kb, lv_keyboard_mode_t mode) {
    lv_keyboard_set_mode(kb,mode);
}

/*
Show the button title in a popover when pressed. 
*/
void stub_lv_keyboard_set_popovers(lv_obj_t * kb, bool en) {
    lv_keyboard_set_popovers(kb,en);
}

/*
Set a new map for the keyboard 
*/
void stub_lv_keyboard_set_map(lv_obj_t * kb, lv_keyboard_mode_t mode, char * map[], lv_buttonmatrix_ctrl_t ctrl_map[]) {
    lv_keyboard_set_map(kb,mode,map,ctrl_map);
}

/*
Assign a Text Area to the Keyboard. The pressed characters will be put there. pointer to the assigned Text Area object 
*/
lv_obj_t * stub_lv_keyboard_get_textarea(lv_obj_t * kb) {
    return lv_keyboard_get_textarea(kb);
}

/*
Set a new a mode (text or number map) the current mode from 'lv_keyboard_mode_t' 
*/
lv_keyboard_mode_t stub_lv_keyboard_get_mode(lv_obj_t * kb) {
    return lv_keyboard_get_mode(kb);
}

/*
Tell whether "popovers" mode is enabled or not. true: "popovers" mode is enabled; false: disabled 
*/
bool stub_lv_keyboard_get_popovers(lv_obj_t * obj) {
    return lv_keyboard_get_popovers(obj);
}

/*
Get the current map of a keyboard the current map 
*/
char * * stub_lv_keyboard_get_map_array(lv_obj_t * kb) {
    return lv_keyboard_get_map_array(kb);
}

/*
Get the index of the lastly "activated" button by the user (pressed, released, focused etc) Useful in the event_cb to get the text of the button, check if hidden etc. index of the last released button (LV_BUTTONMATRIX_BUTTON_NONE: if unset) 
*/
uint32_t stub_lv_keyboard_get_selected_button(lv_obj_t * obj) {
    return lv_keyboard_get_selected_button(obj);
}

/*
Get the button's text text of btn_index` button 
*/
char * stub_lv_keyboard_get_button_text(lv_obj_t * obj, uint32_t btn_id) {
    return lv_keyboard_get_button_text(obj,btn_id);
}

/*
Default keyboard event to add characters to the Text area and change the map. If a custom event_cb is added to the keyboard this function can be called from it to handle the button clicks 
*/
void stub_lv_keyboard_def_event_cb(lv_event_t * e) {
    lv_keyboard_def_event_cb(e);
}

/*
Create a led object pointer to the created led 
*/
lv_obj_t * stub_lv_led_create(lv_obj_t * parent) {
    return lv_led_create(parent);
}

/*
Set the color of the LED 
*/
void stub_lv_led_set_color(lv_obj_t * led, lv_color_t color) {
    lv_led_set_color(led,color);
}

/*
Set the brightness of a LED object 
*/
void stub_lv_led_set_brightness(lv_obj_t * led, uint8_t bright) {
    lv_led_set_brightness(led,bright);
}

/*
Light on a LED 
*/
void stub_lv_led_on(lv_obj_t * led) {
    lv_led_on(led);
}

/*
Light off a LED 
*/
void stub_lv_led_off(lv_obj_t * led) {
    lv_led_off(led);
}

/*
Toggle the state of a LED 
*/
void stub_lv_led_toggle(lv_obj_t * led) {
    lv_led_toggle(led);
}

/*
Get the brightness of a LED object bright 0 (max. dark) ... 255 (max. light) 
*/
uint8_t stub_lv_led_get_brightness(lv_obj_t * obj) {
    return lv_led_get_brightness(obj);
}

/*
Create a line object pointer to the created line 
*/
lv_obj_t * stub_lv_line_create(lv_obj_t * parent) {
    return lv_line_create(parent);
}

/*
Set an array of points. The line object will connect these points. 
*/
void stub_lv_line_set_points(lv_obj_t * obj, lv_point_precise_t points[], uint32_t point_num) {
    lv_line_set_points(obj,points,point_num);
}

/*
Set a non-const array of points. Identical to lv_line_set_points except the array may be retrieved by lv_line_get_points_mutable . 
*/
void stub_lv_line_set_points_mutable(lv_obj_t * obj, lv_point_precise_t points[], uint32_t point_num) {
    lv_line_set_points_mutable(obj,points,point_num);
}

/*
Enable (or disable) the y coordinate inversion. If enabled then y will be subtracted from the height of the object, therefore the y = 0 coordinate will be on the bottom. 
*/
void stub_lv_line_set_y_invert(lv_obj_t * obj, bool en) {
    lv_line_set_y_invert(obj,en);
}

/*
Get the pointer to the array of points. const pointer to the array of points 
*/
lv_point_precise_t * stub_lv_line_get_points(lv_obj_t * obj) {
    return lv_line_get_points(obj);
}

/*
Get the number of points in the array of points. number of points in array of points 
*/
uint32_t stub_lv_line_get_point_count(lv_obj_t * obj) {
    return lv_line_get_point_count(obj);
}

/*
Check the mutability of the stored point array pointer. true: the point array pointer is mutable, false: constant 
*/
bool stub_lv_line_is_point_array_mutable(lv_obj_t * obj) {
    return lv_line_is_point_array_mutable(obj);
}

/*
Get a pointer to the mutable array of points or NULL if it is not mutable pointer to the array of points. NULL if not mutable. 
*/
lv_point_precise_t * stub_lv_line_get_points_mutable(lv_obj_t * obj) {
    return lv_line_get_points_mutable(obj);
}

/*
Get the y inversion attribute true: y inversion is enabled, false: disabled 
*/
bool stub_lv_line_get_y_invert(lv_obj_t * obj) {
    return lv_line_get_y_invert(obj);
}

/*
Create a list object pointer to the created list 
*/
lv_obj_t * stub_lv_list_create(lv_obj_t * parent) {
    return lv_list_create(parent);
}

/*
Add text to a list pointer to the created label 
*/
lv_obj_t * stub_lv_list_add_text(lv_obj_t * list, char * txt) {
    return lv_list_add_text(list,txt);
}

/*
Add button to a list pointer to the created button 
*/
lv_obj_t * stub_lv_list_add_button(lv_obj_t * list, void * icon, char * txt) {
    return lv_list_add_button(list,icon,txt);
}

/*
Get text of a given list button text of btn, if btn doesn't have text "" will be returned 
*/
char * stub_lv_list_get_button_text(lv_obj_t * list, lv_obj_t * btn) {
    return lv_list_get_button_text(list,btn);
}

/*
Set text of a given list button 
*/
void stub_lv_list_set_button_text(lv_obj_t * list, lv_obj_t * btn, char * txt) {
    lv_list_set_button_text(list,btn,txt);
}

/*
Create a menu object pointer to the created menu 
*/
lv_obj_t * stub_lv_menu_create(lv_obj_t * parent) {
    return lv_menu_create(parent);
}

/*
Create a menu page object pointer to the created menu page 
*/
lv_obj_t * stub_lv_menu_page_create(lv_obj_t * parent, char * title) {
    return lv_menu_page_create(parent,title);
}

/*
Create a menu cont object pointer to the created menu cont 
*/
lv_obj_t * stub_lv_menu_cont_create(lv_obj_t * parent) {
    return lv_menu_cont_create(parent);
}

/*
Create a menu section object pointer to the created menu section 
*/
lv_obj_t * stub_lv_menu_section_create(lv_obj_t * parent) {
    return lv_menu_section_create(parent);
}

/*
Create a menu separator object pointer to the created menu separator 
*/
lv_obj_t * stub_lv_menu_separator_create(lv_obj_t * parent) {
    return lv_menu_separator_create(parent);
}

/*
Set menu page to display in main 
*/
void stub_lv_menu_set_page(lv_obj_t * obj, lv_obj_t * page) {
    lv_menu_set_page(obj,page);
}

/*
Set menu page title 
*/
void stub_lv_menu_set_page_title(lv_obj_t * page, char * title) {
    lv_menu_set_page_title(page,title);
}

/*
Set menu page title with a static text. It will not be saved by the label so the 'text' variable has to be 'alive' while the page exists. 
*/
void stub_lv_menu_set_page_title_static(lv_obj_t * page, char * title) {
    lv_menu_set_page_title_static(page,title);
}

/*
Set menu page to display in sidebar 
*/
void stub_lv_menu_set_sidebar_page(lv_obj_t * obj, lv_obj_t * page) {
    lv_menu_set_sidebar_page(obj,page);
}

/*
Set the how the header should behave and its position 
*/
void stub_lv_menu_set_mode_header(lv_obj_t * obj, lv_menu_mode_header_t mode) {
    lv_menu_set_mode_header(obj,mode);
}

/*
Set whether back button should appear at root 
*/
void stub_lv_menu_set_mode_root_back_button(lv_obj_t * obj, lv_menu_mode_root_back_button_t mode) {
    lv_menu_set_mode_root_back_button(obj,mode);
}

/*
Add menu to the menu item 
*/
void stub_lv_menu_set_load_page_event(lv_obj_t * menu, lv_obj_t * obj, lv_obj_t * page) {
    lv_menu_set_load_page_event(menu,obj,page);
}

/*
Get a pointer to menu page that is currently displayed in main pointer to current page 
*/
lv_obj_t * stub_lv_menu_get_cur_main_page(lv_obj_t * obj) {
    return lv_menu_get_cur_main_page(obj);
}

/*
Get a pointer to menu page that is currently displayed in sidebar pointer to current page 
*/
lv_obj_t * stub_lv_menu_get_cur_sidebar_page(lv_obj_t * obj) {
    return lv_menu_get_cur_sidebar_page(obj);
}

/*
Get a pointer to main header obj pointer to main header obj 
*/
lv_obj_t * stub_lv_menu_get_main_header(lv_obj_t * obj) {
    return lv_menu_get_main_header(obj);
}

/*
Get a pointer to main header back btn obj pointer to main header back btn obj 
*/
lv_obj_t * stub_lv_menu_get_main_header_back_button(lv_obj_t * obj) {
    return lv_menu_get_main_header_back_button(obj);
}

/*
Get a pointer to sidebar header obj pointer to sidebar header obj 
*/
lv_obj_t * stub_lv_menu_get_sidebar_header(lv_obj_t * obj) {
    return lv_menu_get_sidebar_header(obj);
}

/*
Get a pointer to sidebar header obj pointer to sidebar header back btn obj 
*/
lv_obj_t * stub_lv_menu_get_sidebar_header_back_button(lv_obj_t * obj) {
    return lv_menu_get_sidebar_header_back_button(obj);
}

/*
Check if an obj is a root back btn true if it is a root back btn 
*/
bool stub_lv_menu_back_button_is_root(lv_obj_t * menu, lv_obj_t * obj) {
    return lv_menu_back_button_is_root(menu,obj);
}

/*
Clear menu history 
*/
void stub_lv_menu_clear_history(lv_obj_t * obj) {
    lv_menu_clear_history(obj);
}

/*
Create an empty message box the created message box 
*/
lv_obj_t * stub_lv_msgbox_create(lv_obj_t * parent) {
    return lv_msgbox_create(parent);
}

/*
Add title to the message box. It also creates a header for the title. the created title label 
*/
lv_obj_t * stub_lv_msgbox_add_title(lv_obj_t * obj, char * title) {
    return lv_msgbox_add_title(obj,title);
}

/*
Add a button to the header of to the message box. It also creates a header. the created button 
*/
lv_obj_t * stub_lv_msgbox_add_header_button(lv_obj_t * obj, void * icon) {
    return lv_msgbox_add_header_button(obj,icon);
}

/*
Add a text to the content area of message box. Multiple texts will be created below each other. the created button 
*/
lv_obj_t * stub_lv_msgbox_add_text(lv_obj_t * obj, char * text) {
    return lv_msgbox_add_text(obj,text);
}

/*
Add a button to the footer of to the message box. It also creates a footer. the created button 
*/
lv_obj_t * stub_lv_msgbox_add_footer_button(lv_obj_t * obj, char * text) {
    return lv_msgbox_add_footer_button(obj,text);
}

/*
Add a close button to the message box. It also creates a header. the created close button 
*/
lv_obj_t * stub_lv_msgbox_add_close_button(lv_obj_t * obj) {
    return lv_msgbox_add_close_button(obj);
}

/*
Get the header widget the header, or NULL if not exists 
*/
lv_obj_t * stub_lv_msgbox_get_header(lv_obj_t * obj) {
    return lv_msgbox_get_header(obj);
}

/*
Get the footer widget the footer, or NULL if not exists 
*/
lv_obj_t * stub_lv_msgbox_get_footer(lv_obj_t * obj) {
    return lv_msgbox_get_footer(obj);
}

/*
Get the content widget the content 
*/
lv_obj_t * stub_lv_msgbox_get_content(lv_obj_t * obj) {
    return lv_msgbox_get_content(obj);
}

/*
Get the title label the title, or NULL if it does not exist 
*/
lv_obj_t * stub_lv_msgbox_get_title(lv_obj_t * obj) {
    return lv_msgbox_get_title(obj);
}

/*
Close a message box 
*/
void stub_lv_msgbox_close(lv_obj_t * mbox) {
    lv_msgbox_close(mbox);
}

/*
Close a message box in the next call of the message box 
*/
void stub_lv_msgbox_close_async(lv_obj_t * mbox) {
    lv_msgbox_close_async(mbox);
}

/*
Create a roller object pointer to the created roller 
*/
lv_obj_t * stub_lv_roller_create(lv_obj_t * parent) {
    return lv_roller_create(parent);
}

/*
Set the options on a roller 
*/
void stub_lv_roller_set_options(lv_obj_t * obj, char * options, lv_roller_mode_t mode) {
    lv_roller_set_options(obj,options,mode);
}

/*
Set the selected option 
*/
void stub_lv_roller_set_selected(lv_obj_t * obj, uint32_t sel_opt, lv_anim_enable_t anim) {
    lv_roller_set_selected(obj,sel_opt,anim);
}

/*
Set the height to show the given number of rows (options) 
*/
void stub_lv_roller_set_visible_row_count(lv_obj_t * obj, uint32_t row_cnt) {
    lv_roller_set_visible_row_count(obj,row_cnt);
}

/*
Get the index of the selected option index of the selected option (0 ... number of option - 1); 
*/
uint32_t stub_lv_roller_get_selected(lv_obj_t * obj) {
    return lv_roller_get_selected(obj);
}

/*
Get the current selected option as a string. 
*/
void stub_lv_roller_get_selected_str(lv_obj_t * obj, char * buf, uint32_t buf_size) {
    lv_roller_get_selected_str(obj,buf,buf_size);
}

/*
Get the options of a roller the options separated by ' '-s (E.g. "Option1\nOption2\nOption3") 
*/
char * stub_lv_roller_get_options(lv_obj_t * obj) {
    return lv_roller_get_options(obj);
}

/*
Get the total number of options the total number of options 
*/
uint32_t stub_lv_roller_get_option_count(lv_obj_t * obj) {
    return lv_roller_get_option_count(obj);
}

/*
Create an scale object pointer to the created scale 
*/
lv_obj_t * stub_lv_scale_create(lv_obj_t * parent) {
    return lv_scale_create(parent);
}

/*
Set scale mode. See lv_scale_mode_t 
*/
void stub_lv_scale_set_mode(lv_obj_t * obj, lv_scale_mode_t mode) {
    lv_scale_set_mode(obj,mode);
}

/*
Set scale total tick count (including minor and major ticks) 
*/
void stub_lv_scale_set_total_tick_count(lv_obj_t * obj, uint32_t total_tick_count) {
    lv_scale_set_total_tick_count(obj,total_tick_count);
}

/*
Sets how often the major tick will be drawn 
*/
void stub_lv_scale_set_major_tick_every(lv_obj_t * obj, uint32_t major_tick_every) {
    lv_scale_set_major_tick_every(obj,major_tick_every);
}

/*
Sets label visibility 
*/
void stub_lv_scale_set_label_show(lv_obj_t * obj, bool show_label) {
    lv_scale_set_label_show(obj,show_label);
}

/*
Set the minimal and maximal values on a scale 
*/
void stub_lv_scale_set_range(lv_obj_t * obj, int32_t min, int32_t max) {
    lv_scale_set_range(obj,min,max);
}

/*
Set properties specific to round scale 
*/
void stub_lv_scale_set_angle_range(lv_obj_t * obj, uint32_t angle_range) {
    lv_scale_set_angle_range(obj,angle_range);
}

/*
Set properties specific to round scale 
*/
void stub_lv_scale_set_rotation(lv_obj_t * obj, int32_t rotation) {
    lv_scale_set_rotation(obj,rotation);
}

/*
Point the needle to the corresponding value through the line 
*/
void stub_lv_scale_set_line_needle_value(lv_obj_t * obj, lv_obj_t * needle_line, int32_t needle_length, int32_t value) {
    lv_scale_set_line_needle_value(obj,needle_line,needle_length,value);
}

/*
Point the needle to the corresponding value through the image, image must point to the right. E.g. -O------> 
*/
void stub_lv_scale_set_image_needle_value(lv_obj_t * obj, lv_obj_t * needle_img, int32_t value) {
    lv_scale_set_image_needle_value(obj,needle_img,value);
}

/*
Set custom text source for major ticks labels 
*/
void stub_lv_scale_set_text_src(lv_obj_t * obj, char * txt_src[]) {
    lv_scale_set_text_src(obj,txt_src);
}

/*
Draw the scale after all the children are drawn 
*/
void stub_lv_scale_set_post_draw(lv_obj_t * obj, bool en) {
    lv_scale_set_post_draw(obj,en);
}

/*
Draw the scale ticks on top of all parts 
*/
void stub_lv_scale_set_draw_ticks_on_top(lv_obj_t * obj, bool en) {
    lv_scale_set_draw_ticks_on_top(obj,en);
}

/*
Add a section to the given scale pointer to the new section 
*/
lv_scale_section_t * stub_lv_scale_add_section(lv_obj_t * obj) {
    return lv_scale_add_section(obj);
}

/*
Set the range for the given scale section 
*/
void stub_lv_scale_section_set_range(lv_scale_section_t * section, int32_t minor_range, int32_t major_range) {
    lv_scale_section_set_range(section,minor_range,major_range);
}

/*
Set the style of the part for the given scale section 
*/
void stub_lv_scale_section_set_style(lv_scale_section_t * section, lv_part_t part, lv_style_t * section_part_style) {
    lv_scale_section_set_style(section,part,section_part_style);
}

/*
Get scale mode. See lv_scale_mode_t Scale mode 
*/
lv_scale_mode_t stub_lv_scale_get_mode(lv_obj_t * obj) {
    return lv_scale_get_mode(obj);
}

/*
Get scale total tick count (including minor and major ticks) Scale total tick count 
*/
int32_t stub_lv_scale_get_total_tick_count(lv_obj_t * obj) {
    return lv_scale_get_total_tick_count(obj);
}

/*
Gets how often the major tick will be drawn Scale major tick every count 
*/
int32_t stub_lv_scale_get_major_tick_every(lv_obj_t * obj) {
    return lv_scale_get_major_tick_every(obj);
}

/*
Gets label visibility true if tick label is enabled, false otherwise 
*/
bool stub_lv_scale_get_label_show(lv_obj_t * obj) {
    return lv_scale_get_label_show(obj);
}

/*
Get angle range of a round scale Scale angle_range 
*/
uint32_t stub_lv_scale_get_angle_range(lv_obj_t * obj) {
    return lv_scale_get_angle_range(obj);
}

/*
Get the min range for the given scale section section minor range 
*/
int32_t stub_lv_scale_get_range_min_value(lv_obj_t * obj) {
    return lv_scale_get_range_min_value(obj);
}

/*
Get the max range for the given scale section section max range 
*/
int32_t stub_lv_scale_get_range_max_value(lv_obj_t * obj) {
    return lv_scale_get_range_max_value(obj);
}

/*
Create a slider object pointer to the created slider 
*/
lv_obj_t * stub_lv_slider_create(lv_obj_t * parent) {
    return lv_slider_create(parent);
}

/*
Set a new value on the slider 
*/
void stub_lv_slider_set_value(lv_obj_t * obj, int32_t value, lv_anim_enable_t anim) {
    lv_slider_set_value(obj,value,anim);
}

/*
Set a new value for the left knob of a slider 
*/
void stub_lv_slider_set_left_value(lv_obj_t * obj, int32_t value, lv_anim_enable_t anim) {
    lv_slider_set_left_value(obj,value,anim);
}

/*
Set minimum and the maximum values of a bar 
*/
void stub_lv_slider_set_range(lv_obj_t * obj, int32_t min, int32_t max) {
    lv_slider_set_range(obj,min,max);
}

/*
Set the mode of slider. 
*/
void stub_lv_slider_set_mode(lv_obj_t * obj, lv_slider_mode_t mode) {
    lv_slider_set_mode(obj,mode);
}

/*
Get the value of the main knob of a slider the value of the main knob of the slider 
*/
int32_t stub_lv_slider_get_value(lv_obj_t * obj) {
    return lv_slider_get_value(obj);
}

/*
Get the value of the left knob of a slider the value of the left knob of the slider 
*/
int32_t stub_lv_slider_get_left_value(lv_obj_t * obj) {
    return lv_slider_get_left_value(obj);
}

/*
Get the minimum value of a slider the minimum value of the slider 
*/
int32_t stub_lv_slider_get_min_value(lv_obj_t * obj) {
    return lv_slider_get_min_value(obj);
}

/*
Get the maximum value of a slider the maximum value of the slider 
*/
int32_t stub_lv_slider_get_max_value(lv_obj_t * obj) {
    return lv_slider_get_max_value(obj);
}

/*
Give the slider is being dragged or not true: drag in progress false: not dragged 
*/
bool stub_lv_slider_is_dragged(lv_obj_t * obj) {
    return lv_slider_is_dragged(obj);
}

/*
Get the mode of the slider. see lv_slider_mode_t 
*/
lv_slider_mode_t stub_lv_slider_get_mode(lv_obj_t * slider) {
    return lv_slider_get_mode(slider);
}

/*
Give the slider is in symmetrical mode or not true: in symmetrical mode false : not in 
*/
bool stub_lv_slider_is_symmetrical(lv_obj_t * obj) {
    return lv_slider_is_symmetrical(obj);
}

void stub_lv_span_stack_init(void) {
    lv_span_stack_init();
}

void stub_lv_span_stack_deinit(void) {
    lv_span_stack_deinit();
}

/*
Create a spangroup object pointer to the created spangroup 
*/
lv_obj_t * stub_lv_spangroup_create(lv_obj_t * parent) {
    return lv_spangroup_create(parent);
}

/*
Create a span string descriptor and add to spangroup. pointer to the created span. 
*/
lv_span_t * stub_lv_spangroup_new_span(lv_obj_t * obj) {
    return lv_spangroup_new_span(obj);
}

/*
Remove the span from the spangroup and free memory. 
*/
void stub_lv_spangroup_delete_span(lv_obj_t * obj, lv_span_t * span) {
    lv_spangroup_delete_span(obj,span);
}

/*
Set a new text for a span. Memory will be allocated to store the text by the span. 
*/
void stub_lv_span_set_text(lv_span_t * span, char * text) {
    lv_span_set_text(span,text);
}

/*
Set a static text. It will not be saved by the span so the 'text' variable has to be 'alive' while the span exist. 
*/
void stub_lv_span_set_text_static(lv_span_t * span, char * text) {
    lv_span_set_text_static(span,text);
}

/*
Set the align of the spangroup. 
*/
void stub_lv_spangroup_set_align(lv_obj_t * obj, lv_text_align_t align) {
    lv_spangroup_set_align(obj,align);
}

/*
Set the overflow of the spangroup. 
*/
void stub_lv_spangroup_set_overflow(lv_obj_t * obj, lv_span_overflow_t overflow) {
    lv_spangroup_set_overflow(obj,overflow);
}

/*
Set the indent of the spangroup. 
*/
void stub_lv_spangroup_set_indent(lv_obj_t * obj, int32_t indent) {
    lv_spangroup_set_indent(obj,indent);
}

/*
Set the mode of the spangroup. 
*/
void stub_lv_spangroup_set_mode(lv_obj_t * obj, lv_span_mode_t mode) {
    lv_spangroup_set_mode(obj,mode);
}

/*
Set maximum lines of the spangroup. 
*/
void stub_lv_spangroup_set_max_lines(lv_obj_t * obj, int32_t lines) {
    lv_spangroup_set_max_lines(obj,lines);
}

/*
Get a pointer to the style of a span pointer to the style. valid as long as the span is valid 
*/
lv_style_t * stub_lv_span_get_style(lv_span_t * span) {
    return lv_span_get_style(span);
}

/*
Get a pointer to the text of a span pointer to the text 
*/
char * stub_lv_span_get_text(lv_span_t * span) {
    return lv_span_get_text(span);
}

/*
Get a spangroup child by its index. 

The child span at index id , or NULL if the ID does not exist  
*/
lv_span_t * stub_lv_spangroup_get_child(lv_obj_t * obj, int32_t id) {
    return lv_spangroup_get_child(obj,id);
}

/*
Get number of spans the span count of the spangroup. 
*/
uint32_t stub_lv_spangroup_get_span_count(lv_obj_t * obj) {
    return lv_spangroup_get_span_count(obj);
}

/*
Get the align of the spangroup. the align value. 
*/
lv_text_align_t stub_lv_spangroup_get_align(lv_obj_t * obj) {
    return lv_spangroup_get_align(obj);
}

/*
Get the overflow of the spangroup. the overflow value. 
*/
lv_span_overflow_t stub_lv_spangroup_get_overflow(lv_obj_t * obj) {
    return lv_spangroup_get_overflow(obj);
}

/*
Get the indent of the spangroup. the indent value. 
*/
int32_t stub_lv_spangroup_get_indent(lv_obj_t * obj) {
    return lv_spangroup_get_indent(obj);
}

/*
Get the mode of the spangroup. 
*/
lv_span_mode_t stub_lv_spangroup_get_mode(lv_obj_t * obj) {
    return lv_spangroup_get_mode(obj);
}

/*
Get maximum lines of the spangroup. the max lines value. 
*/
int32_t stub_lv_spangroup_get_max_lines(lv_obj_t * obj) {
    return lv_spangroup_get_max_lines(obj);
}

/*
Get max line height of all span in the spangroup. 
*/
int32_t stub_lv_spangroup_get_max_line_height(lv_obj_t * obj) {
    return lv_spangroup_get_max_line_height(obj);
}

/*
Get the text content width when all span of spangroup on a line. text content width or max_width. 
*/
uint32_t stub_lv_spangroup_get_expand_width(lv_obj_t * obj, uint32_t max_width) {
    return lv_spangroup_get_expand_width(obj,max_width);
}

/*
Get the text content height with width fixed. 
*/
int32_t stub_lv_spangroup_get_expand_height(lv_obj_t * obj, int32_t width) {
    return lv_spangroup_get_expand_height(obj,width);
}

/*
Get the span's coords in the spangroup. Before calling this function, please make sure that the layout of span group has been updated. Like calling :ref:`lv_obj_update_layout()` like function. +--------+
|Heading +--->------------------+
|  Pos   |   |     Heading      |
+--------+---+------------------+
|                               |
|                               |
|                               |
|            Middle   +--------+|
|                     |Trailing||
|                   +-|  Pos   ||
|                   | +--------+|
+-------------------v-----------+
|     Trailing      |
+-------------------+  the span's coords in the spangroup. 
*/
lv_span_coords_t stub_lv_spangroup_get_span_coords(lv_obj_t * obj, lv_span_t * span) {
    return lv_spangroup_get_span_coords(obj,span);
}

/*
Get the span object by point. pointer to the span under the point or NULL if not found. 
*/
lv_span_t * stub_lv_spangroup_get_span_by_point(lv_obj_t * obj, lv_point_t * point) {
    return lv_spangroup_get_span_by_point(obj,point);
}

/*
Update the mode of the spangroup. 
*/
void stub_lv_spangroup_refr_mode(lv_obj_t * obj) {
    lv_spangroup_refr_mode(obj);
}

/*
Create a text area object pointer to the created text area 
*/
lv_obj_t * stub_lv_textarea_create(lv_obj_t * parent) {
    return lv_textarea_create(parent);
}

/*
Insert a character to the current cursor position. To add a wide char, e.g. 'Á' use lv_text_encoded_conv_wc('Á ) 
*/
void stub_lv_textarea_add_char(lv_obj_t * obj, uint32_t c) {
    lv_textarea_add_char(obj,c);
}

/*
Insert a text to the current cursor position 
*/
void stub_lv_textarea_add_text(lv_obj_t * obj, char * txt) {
    lv_textarea_add_text(obj,txt);
}

/*
Delete a the left character from the current cursor position 
*/
void stub_lv_textarea_delete_char(lv_obj_t * obj) {
    lv_textarea_delete_char(obj);
}

/*
Delete the right character from the current cursor position 
*/
void stub_lv_textarea_delete_char_forward(lv_obj_t * obj) {
    lv_textarea_delete_char_forward(obj);
}

/*
Set the text of a text area 
*/
void stub_lv_textarea_set_text(lv_obj_t * obj, char * txt) {
    lv_textarea_set_text(obj,txt);
}

/*
Set the placeholder text of a text area 
*/
void stub_lv_textarea_set_placeholder_text(lv_obj_t * obj, char * txt) {
    lv_textarea_set_placeholder_text(obj,txt);
}

/*
Set the cursor position 
*/
void stub_lv_textarea_set_cursor_pos(lv_obj_t * obj, int32_t pos) {
    lv_textarea_set_cursor_pos(obj,pos);
}

/*
Enable/Disable the positioning of the cursor by clicking the text on the text area. 
*/
void stub_lv_textarea_set_cursor_click_pos(lv_obj_t * obj, bool en) {
    lv_textarea_set_cursor_click_pos(obj,en);
}

/*
Enable/Disable password mode 
*/
void stub_lv_textarea_set_password_mode(lv_obj_t * obj, bool en) {
    lv_textarea_set_password_mode(obj,en);
}

/*
Set the replacement characters to show in password mode 
*/
void stub_lv_textarea_set_password_bullet(lv_obj_t * obj, char * bullet) {
    lv_textarea_set_password_bullet(obj,bullet);
}

/*
Configure the text area to one line or back to normal 
*/
void stub_lv_textarea_set_one_line(lv_obj_t * obj, bool en) {
    lv_textarea_set_one_line(obj,en);
}

/*
Set a list of characters. Only these characters will be accepted by the text area 
*/
void stub_lv_textarea_set_accepted_chars(lv_obj_t * obj, char * list) {
    lv_textarea_set_accepted_chars(obj,list);
}

/*
Set max length of a Text Area. 
*/
void stub_lv_textarea_set_max_length(lv_obj_t * obj, uint32_t num) {
    lv_textarea_set_max_length(obj,num);
}

/*
In LV_EVENT_INSERT the text which planned to be inserted can be replaced by another text. It can be used to add automatic formatting to the text area. 
*/
void stub_lv_textarea_set_insert_replace(lv_obj_t * obj, char * txt) {
    lv_textarea_set_insert_replace(obj,txt);
}

/*
Enable/disable selection mode. 
*/
void stub_lv_textarea_set_text_selection(lv_obj_t * obj, bool en) {
    lv_textarea_set_text_selection(obj,en);
}

/*
Set how long show the password before changing it to '*' 
*/
void stub_lv_textarea_set_password_show_time(lv_obj_t * obj, uint32_t time) {
    lv_textarea_set_password_show_time(obj,time);
}

/*
Deprecated Use the normal text_align style property instead Set the label's alignment. It sets where the label is aligned (in one line mode it can be smaller than the text area) and how the lines of the area align in case of multiline text area 
*/
void stub_lv_textarea_set_align(lv_obj_t * obj, lv_text_align_t align) {
    lv_textarea_set_align(obj,align);
}

/*
Get the text of a text area. In password mode it gives the real text (not '*'s). pointer to the text 
*/
char * stub_lv_textarea_get_text(lv_obj_t * obj) {
    return lv_textarea_get_text(obj);
}

/*
Get the placeholder text of a text area pointer to the text 
*/
char * stub_lv_textarea_get_placeholder_text(lv_obj_t * obj) {
    return lv_textarea_get_placeholder_text(obj);
}

/*
Get the label of a text area pointer to the label object 
*/
lv_obj_t * stub_lv_textarea_get_label(lv_obj_t * obj) {
    return lv_textarea_get_label(obj);
}

/*
Get the current cursor position in character index the cursor position 
*/
uint32_t stub_lv_textarea_get_cursor_pos(lv_obj_t * obj) {
    return lv_textarea_get_cursor_pos(obj);
}

/*
Get whether the cursor click positioning is enabled or not. true: enable click positions; false: disable 
*/
bool stub_lv_textarea_get_cursor_click_pos(lv_obj_t * obj) {
    return lv_textarea_get_cursor_click_pos(obj);
}

/*
Get the password mode attribute true: password mode is enabled, false: disabled 
*/
bool stub_lv_textarea_get_password_mode(lv_obj_t * obj) {
    return lv_textarea_get_password_mode(obj);
}

/*
Get the replacement characters to show in password mode pointer to the replacement text 
*/
char * stub_lv_textarea_get_password_bullet(lv_obj_t * obj) {
    return lv_textarea_get_password_bullet(obj);
}

/*
Get the one line configuration attribute true: one line configuration is enabled, false: disabled 
*/
bool stub_lv_textarea_get_one_line(lv_obj_t * obj) {
    return lv_textarea_get_one_line(obj);
}

/*
Get a list of accepted characters. list of accented characters. 
*/
char * stub_lv_textarea_get_accepted_chars(lv_obj_t * obj) {
    return lv_textarea_get_accepted_chars(obj);
}

/*
Get max length of a Text Area. the maximal number of characters to be add 
*/
uint32_t stub_lv_textarea_get_max_length(lv_obj_t * obj) {
    return lv_textarea_get_max_length(obj);
}

/*
Find whether text is selected or not. whether text is selected or not 
*/
bool stub_lv_textarea_text_is_selected(lv_obj_t * obj) {
    return lv_textarea_text_is_selected(obj);
}

/*
Find whether selection mode is enabled. true: selection mode is enabled, false: disabled 
*/
bool stub_lv_textarea_get_text_selection(lv_obj_t * obj) {
    return lv_textarea_get_text_selection(obj);
}

/*
Set how long show the password before changing it to '*' show time in milliseconds. 0: hide immediately. 
*/
uint32_t stub_lv_textarea_get_password_show_time(lv_obj_t * obj) {
    return lv_textarea_get_password_show_time(obj);
}

/*
Get a the character from the current cursor position a the character or 0 
*/
uint32_t stub_lv_textarea_get_current_char(lv_obj_t * obj) {
    return lv_textarea_get_current_char(obj);
}

/*
Clear the selection on the text area. 
*/
void stub_lv_textarea_clear_selection(lv_obj_t * obj) {
    lv_textarea_clear_selection(obj);
}

/*
Move the cursor one character right 
*/
void stub_lv_textarea_cursor_right(lv_obj_t * obj) {
    lv_textarea_cursor_right(obj);
}

/*
Move the cursor one character left 
*/
void stub_lv_textarea_cursor_left(lv_obj_t * obj) {
    lv_textarea_cursor_left(obj);
}

/*
Move the cursor one line down 
*/
void stub_lv_textarea_cursor_down(lv_obj_t * obj) {
    lv_textarea_cursor_down(obj);
}

/*
Move the cursor one line up 
*/
void stub_lv_textarea_cursor_up(lv_obj_t * obj) {
    lv_textarea_cursor_up(obj);
}

/*
Create a spinbox object pointer to the created spinbox 
*/
lv_obj_t * stub_lv_spinbox_create(lv_obj_t * parent) {
    return lv_spinbox_create(parent);
}

/*
Set spinbox value 
*/
void stub_lv_spinbox_set_value(lv_obj_t * obj, int32_t v) {
    lv_spinbox_set_value(obj,v);
}

/*
Set spinbox rollover function 
*/
void stub_lv_spinbox_set_rollover(lv_obj_t * obj, bool rollover) {
    lv_spinbox_set_rollover(obj,rollover);
}

/*
Set spinbox digit format (digit count and decimal format) 
*/
void stub_lv_spinbox_set_digit_format(lv_obj_t * obj, uint32_t digit_count, uint32_t sep_pos) {
    lv_spinbox_set_digit_format(obj,digit_count,sep_pos);
}

/*
Set spinbox step 
*/
void stub_lv_spinbox_set_step(lv_obj_t * obj, uint32_t step) {
    lv_spinbox_set_step(obj,step);
}

/*
Set spinbox value range 
*/
void stub_lv_spinbox_set_range(lv_obj_t * obj, int32_t range_min, int32_t range_max) {
    lv_spinbox_set_range(obj,range_min,range_max);
}

/*
Set cursor position to a specific digit for edition 
*/
void stub_lv_spinbox_set_cursor_pos(lv_obj_t * obj, uint32_t pos) {
    lv_spinbox_set_cursor_pos(obj,pos);
}

/*
Set direction of digit step when clicking an encoder button while in editing mode 
*/
void stub_lv_spinbox_set_digit_step_direction(lv_obj_t * obj, lv_dir_t direction) {
    lv_spinbox_set_digit_step_direction(obj,direction);
}

/*
Get spinbox rollover function status 
*/
bool stub_lv_spinbox_get_rollover(lv_obj_t * obj) {
    return lv_spinbox_get_rollover(obj);
}

/*
Get the spinbox numeral value (user has to convert to float according to its digit format) value integer value of the spinbox 
*/
int32_t stub_lv_spinbox_get_value(lv_obj_t * obj) {
    return lv_spinbox_get_value(obj);
}

/*
Get the spinbox step value (user has to convert to float according to its digit format) value integer step value of the spinbox 
*/
int32_t stub_lv_spinbox_get_step(lv_obj_t * obj) {
    return lv_spinbox_get_step(obj);
}

/*
Select next lower digit for edition by dividing the step by 10 
*/
void stub_lv_spinbox_step_next(lv_obj_t * obj) {
    lv_spinbox_step_next(obj);
}

/*
Select next higher digit for edition by multiplying the step by 10 
*/
void stub_lv_spinbox_step_prev(lv_obj_t * obj) {
    lv_spinbox_step_prev(obj);
}

/*
Increment spinbox value by one step 
*/
void stub_lv_spinbox_increment(lv_obj_t * obj) {
    lv_spinbox_increment(obj);
}

/*
Decrement spinbox value by one step 
*/
void stub_lv_spinbox_decrement(lv_obj_t * obj) {
    lv_spinbox_decrement(obj);
}

/*
Create a spinner widget the created spinner 
*/
lv_obj_t * stub_lv_spinner_create(lv_obj_t * parent) {
    return lv_spinner_create(parent);
}

/*
Set the animation time and arc length of the spinner 
*/
void stub_lv_spinner_set_anim_params(lv_obj_t * obj, uint32_t t, uint32_t angle) {
    lv_spinner_set_anim_params(obj,t,angle);
}

/*
Create a switch object pointer to the created switch 
*/
lv_obj_t * stub_lv_switch_create(lv_obj_t * parent) {
    return lv_switch_create(parent);
}

/*
Set the orientation of switch. 
*/
void stub_lv_switch_set_orientation(lv_obj_t * obj, lv_switch_orientation_t orientation) {
    lv_switch_set_orientation(obj,orientation);
}

/*
Get the orientation of switch. switch orientation from lv_switch_orientation_t 
*/
lv_switch_orientation_t stub_lv_switch_get_orientation(lv_obj_t * obj) {
    return lv_switch_get_orientation(obj);
}

/*
Create a table object pointer to the created table 
*/
lv_obj_t * stub_lv_table_create(lv_obj_t * parent) {
    return lv_table_create(parent);
}

/*
Set the value of a cell. New roes/columns are added automatically if required 
*/
void stub_lv_table_set_cell_value(lv_obj_t * obj, uint32_t row, uint32_t col, char * txt) {
    lv_table_set_cell_value(obj,row,col,txt);
}

/*
Set the value of a cell. Memory will be allocated to store the text by the table. New roes/columns are added automatically if required 
*/
void stub_lv_table_set_cell_value_fmt(lv_obj_t * obj, uint32_t row, uint32_t col, char * fmt, ... ...) {
    lv_table_set_cell_value_fmt(obj,row,col,fmt,...);
}

/*
Set the number of rows 
*/
void stub_lv_table_set_row_count(lv_obj_t * obj, uint32_t row_cnt) {
    lv_table_set_row_count(obj,row_cnt);
}

/*
Set the number of columns 
*/
void stub_lv_table_set_column_count(lv_obj_t * obj, uint32_t col_cnt) {
    lv_table_set_column_count(obj,col_cnt);
}

/*
Set the width of a column 
*/
void stub_lv_table_set_column_width(lv_obj_t * obj, uint32_t col_id, int32_t w) {
    lv_table_set_column_width(obj,col_id,w);
}

/*
Add control bits to the cell. 
*/
void stub_lv_table_add_cell_ctrl(lv_obj_t * obj, uint32_t row, uint32_t col, lv_table_cell_ctrl_t ctrl) {
    lv_table_add_cell_ctrl(obj,row,col,ctrl);
}

/*
Clear control bits of the cell. 
*/
void stub_lv_table_clear_cell_ctrl(lv_obj_t * obj, uint32_t row, uint32_t col, lv_table_cell_ctrl_t ctrl) {
    lv_table_clear_cell_ctrl(obj,row,col,ctrl);
}

/*
Add custom user data to the cell. 
*/
void stub_lv_table_set_cell_user_data(lv_obj_t * obj, uint16_t row, uint16_t col, void * user_data) {
    lv_table_set_cell_user_data(obj,row,col,user_data);
}

/*
Set the selected cell 
*/
void stub_lv_table_set_selected_cell(lv_obj_t * obj, uint16_t row, uint16_t col) {
    lv_table_set_selected_cell(obj,row,col);
}

/*
Get the value of a cell. text in the cell 
*/
char * stub_lv_table_get_cell_value(lv_obj_t * obj, uint32_t row, uint32_t col) {
    return lv_table_get_cell_value(obj,row,col);
}

/*
Get the number of rows. number of rows. 
*/
uint32_t stub_lv_table_get_row_count(lv_obj_t * obj) {
    return lv_table_get_row_count(obj);
}

/*
Get the number of columns. number of columns. 
*/
uint32_t stub_lv_table_get_column_count(lv_obj_t * obj) {
    return lv_table_get_column_count(obj);
}

/*
Get the width of a column width of the column 
*/
int32_t stub_lv_table_get_column_width(lv_obj_t * obj, uint32_t col) {
    return lv_table_get_column_width(obj,col);
}

/*
Get whether a cell has the control bits true: all control bits are set; false: not all control bits are set 
*/
bool stub_lv_table_has_cell_ctrl(lv_obj_t * obj, uint32_t row, uint32_t col, lv_table_cell_ctrl_t ctrl) {
    return lv_table_has_cell_ctrl(obj,row,col,ctrl);
}

/*
Get the selected cell (pressed and or focused) 
*/
void stub_lv_table_get_selected_cell(lv_obj_t * obj, uint32_t * row, uint32_t * col) {
    lv_table_get_selected_cell(obj,row,col);
}

/*
Get custom user data to the cell. 
*/
void * stub_lv_table_get_cell_user_data(lv_obj_t * obj, uint16_t row, uint16_t col) {
    return lv_table_get_cell_user_data(obj,row,col);
}

/*
Create a tabview widget the created tabview 
*/
lv_obj_t * stub_lv_tabview_create(lv_obj_t * parent) {
    return lv_tabview_create(parent);
}

/*
Add a tab to the tabview the widget where the content of the tab can be created 
*/
lv_obj_t * stub_lv_tabview_add_tab(lv_obj_t * obj, char * name) {
    return lv_tabview_add_tab(obj,name);
}

/*
Change the name of the tab 
*/
void stub_lv_tabview_rename_tab(lv_obj_t * obj, uint32_t idx, char * new_name) {
    lv_tabview_rename_tab(obj,idx,new_name);
}

/*
Show a tab 
*/
void stub_lv_tabview_set_active(lv_obj_t * obj, uint32_t idx, lv_anim_enable_t anim_en) {
    lv_tabview_set_active(obj,idx,anim_en);
}

/*
Set the position of the tab bar 
*/
void stub_lv_tabview_set_tab_bar_position(lv_obj_t * obj, lv_dir_t dir) {
    lv_tabview_set_tab_bar_position(obj,dir);
}

/*
Set the width or height of the tab bar 
*/
void stub_lv_tabview_set_tab_bar_size(lv_obj_t * obj, int32_t size) {
    lv_tabview_set_tab_bar_size(obj,size);
}

/*
Get the number of tabs the number of tabs 
*/
uint32_t stub_lv_tabview_get_tab_count(lv_obj_t * obj) {
    return lv_tabview_get_tab_count(obj);
}

/*
Get the current tab's index the zero based index of the current tab 
*/
uint32_t stub_lv_tabview_get_tab_active(lv_obj_t * obj) {
    return lv_tabview_get_tab_active(obj);
}

/*
Get the widget where the container of each tab is created the main container widget 
*/
lv_obj_t * stub_lv_tabview_get_content(lv_obj_t * obj) {
    return lv_tabview_get_content(obj);
}

/*
Get the tab bar where the buttons are created the tab bar 
*/
lv_obj_t * stub_lv_tabview_get_tab_bar(lv_obj_t * obj) {
    return lv_tabview_get_tab_bar(obj);
}

/*
Create a tileview object pointer to the created tileview 
*/
lv_obj_t * stub_lv_tileview_create(lv_obj_t * parent) {
    return lv_tileview_create(parent);
}

/*
Add a tile to the tileview pointer to the added tile object 
*/
lv_obj_t * stub_lv_tileview_add_tile(lv_obj_t * tv, uint8_t col_id, uint8_t row_id, lv_dir_t dir) {
    return lv_tileview_add_tile(tv,col_id,row_id,dir);
}

/*
Set the active tile in the tileview. 
*/
void stub_lv_tileview_set_tile(lv_obj_t * tv, lv_obj_t * tile_obj, lv_anim_enable_t anim_en) {
    lv_tileview_set_tile(tv,tile_obj,anim_en);
}

/*
Set the active tile by index in the tileview 
*/
void stub_lv_tileview_set_tile_by_index(lv_obj_t * tv, uint32_t col_id, uint32_t row_id, lv_anim_enable_t anim_en) {
    lv_tileview_set_tile_by_index(tv,col_id,row_id,anim_en);
}

/*
Get the currently active tile in the tileview pointer to the currently active tile object 
*/
lv_obj_t * stub_lv_tileview_get_tile_active(lv_obj_t * obj) {
    return lv_tileview_get_tile_active(obj);
}

/*
Create a window widget the created window 
*/
lv_obj_t * stub_lv_win_create(lv_obj_t * parent) {
    return lv_win_create(parent);
}

/*
Add a title to the window the widget where the content of the title can be created 
*/
lv_obj_t * stub_lv_win_add_title(lv_obj_t * win, char * txt) {
    return lv_win_add_title(win,txt);
}

/*
Add a button to the window the widget where the content of the button can be created 
*/
lv_obj_t * stub_lv_win_add_button(lv_obj_t * win, void * icon, int32_t btn_w) {
    return lv_win_add_button(win,icon,btn_w);
}

/*
Get the header of the window the header of the window 
*/
lv_obj_t * stub_lv_win_get_header(lv_obj_t * win) {
    return lv_win_get_header(win);
}

/*
Get the content of the window the content of the window 
*/
lv_obj_t * stub_lv_win_get_content(lv_obj_t * win) {
    return lv_win_get_content(win);
}

/*
Take snapshot for object with its children, create the draw buffer as needed. a pointer to an draw buffer containing snapshot image, or NULL if failed. 
*/
lv_draw_buf_t * stub_lv_snapshot_take(lv_obj_t * obj, lv_color_format_t cf) {
    return lv_snapshot_take(obj,cf);
}

/*
Create a draw buffer to store the snapshot image for object. a pointer to an draw buffer ready for taking snapshot, or NULL if failed. 
*/
lv_draw_buf_t * stub_lv_snapshot_create_draw_buf(lv_obj_t * obj, lv_color_format_t cf) {
    return lv_snapshot_create_draw_buf(obj,cf);
}

/*
Reshape the draw buffer to prepare for taking snapshot for obj. This is usually used to check if the existing draw buffer is enough for obj snapshot. If return LV_RESULT_INVALID, you should create a new one. 
*/
lv_result_t stub_lv_snapshot_reshape_draw_buf(lv_obj_t * obj, lv_draw_buf_t * draw_buf) {
    return lv_snapshot_reshape_draw_buf(obj,draw_buf);
}

/*
Take snapshot for object with its children, save image info to provided buffer. LV_RESULT_OK on success, LV_RESULT_INVALID on error. 
*/
lv_result_t stub_lv_snapshot_take_to_draw_buf(lv_obj_t * obj, lv_color_format_t cf, lv_draw_buf_t * draw_buf) {
    return lv_snapshot_take_to_draw_buf(obj,cf,draw_buf);
}

/*
Deprecated Use lv_draw_buf_destroy instead. 

Free the snapshot image returned by :ref:`lv_snapshot_take`   
*/
void stub_lv_snapshot_free(lv_image_dsc_t * dsc) {
    lv_snapshot_free(dsc);
}

/*
Take snapshot for object with its children, save image info to provided buffer. LV_RESULT_OK on success, LV_RESULT_INVALID on error.  Deprecated Use lv_snapshot_take_to_draw_buf instead. 
*/
lv_result_t stub_lv_snapshot_take_to_buf(lv_obj_t * obj, lv_color_format_t cf, lv_image_dsc_t * dsc, void * buf, uint32_t buf_size) {
    return lv_snapshot_take_to_buf(obj,cf,dsc,buf,buf_size);
}

/*
Initialize an integer type subject 
*/
void stub_lv_subject_init_int(lv_subject_t * subject, int32_t value) {
    lv_subject_init_int(subject,value);
}

/*
Set the value of an integer subject. It will notify all the observers as well. 
*/
void stub_lv_subject_set_int(lv_subject_t * subject, int32_t value) {
    lv_subject_set_int(subject,value);
}

/*
Get the current value of an integer subject the current value 
*/
int32_t stub_lv_subject_get_int(lv_subject_t * subject) {
    return lv_subject_get_int(subject);
}

/*
Get the previous value of an integer subject the current value 
*/
int32_t stub_lv_subject_get_previous_int(lv_subject_t * subject) {
    return lv_subject_get_previous_int(subject);
}

/*
Initialize a string type subject the string subject stores the whole string, not only a pointer 
*/
void stub_lv_subject_init_string(lv_subject_t * subject, char * buf, char * prev_buf, size_t size, char * value) {
    lv_subject_init_string(subject,buf,prev_buf,size,value);
}

/*
Copy a string to a subject. It will notify all the observers as well. 
*/
void stub_lv_subject_copy_string(lv_subject_t * subject, char * buf) {
    lv_subject_copy_string(subject,buf);
}

/*
Get the current value of an string subject pointer to the buffer containing the current value 
*/
char * stub_lv_subject_get_string(lv_subject_t * subject) {
    return lv_subject_get_string(subject);
}

/*
Get the previous value of an string subject pointer to the buffer containing the current value  NULL will be returned if NULL was passed in :ref:`lv_subject_init_string()` as prev_buf 
*/
char * stub_lv_subject_get_previous_string(lv_subject_t * subject) {
    return lv_subject_get_previous_string(subject);
}

/*
Initialize an pointer type subject 
*/
void stub_lv_subject_init_pointer(lv_subject_t * subject, void * value) {
    lv_subject_init_pointer(subject,value);
}

/*
Set the value of a pointer subject. It will notify all the observers as well. 
*/
void stub_lv_subject_set_pointer(lv_subject_t * subject, void * ptr) {
    lv_subject_set_pointer(subject,ptr);
}

/*
Get the current value of a pointer subject current value 
*/
void * stub_lv_subject_get_pointer(lv_subject_t * subject) {
    return lv_subject_get_pointer(subject);
}

/*
Get the previous value of a pointer subject current value 
*/
void * stub_lv_subject_get_previous_pointer(lv_subject_t * subject) {
    return lv_subject_get_previous_pointer(subject);
}

/*
Initialize an color type subject 
*/
void stub_lv_subject_init_color(lv_subject_t * subject, lv_color_t color) {
    lv_subject_init_color(subject,color);
}

/*
Set the value of a color subject. It will notify all the observers as well. 
*/
void stub_lv_subject_set_color(lv_subject_t * subject, lv_color_t color) {
    lv_subject_set_color(subject,color);
}

/*
Get the current value of a color subject current value 
*/
lv_color_t stub_lv_subject_get_color(lv_subject_t * subject) {
    return lv_subject_get_color(subject);
}

/*
Get the previous value of a color subject current value 
*/
lv_color_t stub_lv_subject_get_previous_color(lv_subject_t * subject) {
    return lv_subject_get_previous_color(subject);
}

/*
Initialize a subject group 
*/
void stub_lv_subject_init_group(lv_subject_t * subject, lv_subject_t * list[], uint32_t list_len) {
    lv_subject_init_group(subject,list,list_len);
}

/*
Remove all the observers from a subject and free all allocated memories in it objects added with lv_subject_add_observer_obj should be already deleted or removed manually. 
*/
void stub_lv_subject_deinit(lv_subject_t * subject) {
    lv_subject_deinit(subject);
}

/*
Get an element from the subject group's list pointer a subject from the list, or NULL if the index is out of bounds 
*/
lv_subject_t * stub_lv_subject_get_group_element(lv_subject_t * subject, int32_t index) {
    return lv_subject_get_group_element(subject,index);
}

/*
Add an observer to a subject. When the subject changes observer_cb will be called. pointer to the created observer 
*/
lv_observer_t * stub_lv_subject_add_observer(lv_subject_t * subject, lv_observer_cb_t observer_cb, void * user_data) {
    return lv_subject_add_observer(subject,observer_cb,user_data);
}

/*
Add an observer to a subject for an object. When the object is deleted, it will be removed from the subject automatically. pointer to the created observer 
*/
lv_observer_t * stub_lv_subject_add_observer_obj(lv_subject_t * subject, lv_observer_cb_t observer_cb, lv_obj_t * obj, void * user_data) {
    return lv_subject_add_observer_obj(subject,observer_cb,obj,user_data);
}

/*
Add an observer to a subject and also save a target. pointer to the created observer 
*/
lv_observer_t * stub_lv_subject_add_observer_with_target(lv_subject_t * subject, lv_observer_cb_t observer_cb, void * target, void * user_data) {
    return lv_subject_add_observer_with_target(subject,observer_cb,target,user_data);
}

/*
Remove an observer from its subject 
*/
void stub_lv_observer_remove(lv_observer_t * observer) {
    lv_observer_remove(observer);
}

/*
Remove the observers of an object from a subject or all subjects This function can be used e.g. when an object's subject(s) needs to be replaced by other subject(s) 
*/
void stub_lv_obj_remove_from_subject(lv_obj_t * obj, lv_subject_t * subject) {
    lv_obj_remove_from_subject(obj,subject);
}

/*
Get the target of an observer pointer to the saved target 
*/
void * stub_lv_observer_get_target(lv_observer_t * observer) {
    return lv_observer_get_target(observer);
}

/*
Get the target object of the observer. It's the same as lv_observer_get_target and added only for semantic reasons pointer to the saved object target 
*/
lv_obj_t * stub_lv_observer_get_target_obj(lv_observer_t * observer) {
    return lv_observer_get_target_obj(observer);
}

/*
Get the user data of the observer. void pointer to the saved user data 
*/
void * stub_lv_observer_get_user_data(lv_observer_t * observer) {
    return lv_observer_get_user_data(observer);
}

/*
Notify all observers of subject 
*/
void stub_lv_subject_notify(lv_subject_t * subject) {
    lv_subject_notify(subject);
}

/*
Set an object flag if an integer subject's value is equal to a reference value, clear the flag otherwise pointer to the created observer 
*/
lv_observer_t * stub_lv_obj_bind_flag_if_eq(lv_obj_t * obj, lv_subject_t * subject, lv_obj_flag_t flag, int32_t ref_value) {
    return lv_obj_bind_flag_if_eq(obj,subject,flag,ref_value);
}

/*
Set an object flag if an integer subject's value is not equal to a reference value, clear the flag otherwise pointer to the created observer 
*/
lv_observer_t * stub_lv_obj_bind_flag_if_not_eq(lv_obj_t * obj, lv_subject_t * subject, lv_obj_flag_t flag, int32_t ref_value) {
    return lv_obj_bind_flag_if_not_eq(obj,subject,flag,ref_value);
}

/*
Set an object state if an integer subject's value is equal to a reference value, clear the flag otherwise pointer to the created observer 
*/
lv_observer_t * stub_lv_obj_bind_state_if_eq(lv_obj_t * obj, lv_subject_t * subject, lv_state_t state, int32_t ref_value) {
    return lv_obj_bind_state_if_eq(obj,subject,state,ref_value);
}

/*
Set an object state if an integer subject's value is not equal to a reference value, clear the flag otherwise pointer to the created observer 
*/
lv_observer_t * stub_lv_obj_bind_state_if_not_eq(lv_obj_t * obj, lv_subject_t * subject, lv_state_t state, int32_t ref_value) {
    return lv_obj_bind_state_if_not_eq(obj,subject,state,ref_value);
}

/*
Set an integer subject to 1 when an object is checked and set it 0 when unchecked. pointer to the created observer  Ensure the object's LV_OBJ_FLAG_CHECKABLE flag is set 
*/
lv_observer_t * stub_lv_obj_bind_checked(lv_obj_t * obj, lv_subject_t * subject) {
    return lv_obj_bind_checked(obj,subject);
}

/*
Bind an integer, string, or pointer subject to a label. pointer to the created observer  fmt == NULL can be used only with string and pointer subjects.  if the subject is a pointer must point to a \0 terminated string. 
*/
lv_observer_t * stub_lv_label_bind_text(lv_obj_t * obj, lv_subject_t * subject, char * fmt) {
    return lv_label_bind_text(obj,subject,fmt);
}

/*
Bind an integer subject to an arc's value pointer to the created observer 
*/
lv_observer_t * stub_lv_arc_bind_value(lv_obj_t * obj, lv_subject_t * subject) {
    return lv_arc_bind_value(obj,subject);
}

/*
Bind an integer subject to a slider's value pointer to the created observer 
*/
lv_observer_t * stub_lv_slider_bind_value(lv_obj_t * obj, lv_subject_t * subject) {
    return lv_slider_bind_value(obj,subject);
}

/*
Bind an integer subject to a roller's value pointer to the created observer 
*/
lv_observer_t * stub_lv_roller_bind_value(lv_obj_t * obj, lv_subject_t * subject) {
    return lv_roller_bind_value(obj,subject);
}

/*
Bind an integer subject to a dropdown's value pointer to the created observer 
*/
lv_observer_t * stub_lv_dropdown_bind_value(lv_obj_t * obj, lv_subject_t * subject) {
    return lv_dropdown_bind_value(obj,subject);
}

/*
Initialize a monkey config with default values 
*/
void stub_lv_monkey_config_init(lv_monkey_config_t * config) {
    lv_monkey_config_init(config);
}

/*
Create monkey for test pointer to the created monkey 
*/
lv_monkey_t * stub_lv_monkey_create(lv_monkey_config_t * config) {
    return lv_monkey_create(config);
}

/*
Get monkey input device pointer to the input device 
*/
lv_indev_t * stub_lv_monkey_get_indev(lv_monkey_t * monkey) {
    return lv_monkey_get_indev(monkey);
}

/*
Enable monkey 
*/
void stub_lv_monkey_set_enable(lv_monkey_t * monkey, bool en) {
    lv_monkey_set_enable(monkey,en);
}

/*
Get whether monkey is enabled return true if monkey enabled 
*/
bool stub_lv_monkey_get_enable(lv_monkey_t * monkey) {
    return lv_monkey_get_enable(monkey);
}

/*
Set the user_data field of the monkey 
*/
void stub_lv_monkey_set_user_data(lv_monkey_t * monkey, void * user_data) {
    lv_monkey_set_user_data(monkey,user_data);
}

/*
Get the user_data field of the monkey the pointer to the user_data of the monkey 
*/
void * stub_lv_monkey_get_user_data(lv_monkey_t * monkey) {
    return lv_monkey_get_user_data(monkey);
}

/*
Delete monkey 
*/
void stub_lv_monkey_delete(lv_monkey_t * monkey) {
    lv_monkey_delete(monkey);
}

/*
Add grid navigation feature to an object. It expects the children to be arranged into a grid-like layout. Although it's not required to have pixel perfect alignment. This feature makes possible to use keys to navigate among the children and focus them. The keys other than arrows and press/release related events are forwarded to the focused child. 
*/
void stub_lv_gridnav_add(lv_obj_t * obj, lv_gridnav_ctrl_t ctrl) {
    lv_gridnav_add(obj,ctrl);
}

/*
Remove the grid navigation support from an object 
*/
void stub_lv_gridnav_remove(lv_obj_t * obj) {
    lv_gridnav_remove(obj);
}

/*
Manually focus an object on gridnav container 
*/
void stub_lv_gridnav_set_focused(lv_obj_t * cont, lv_obj_t * to_focus, lv_anim_enable_t anim_en) {
    lv_gridnav_set_focused(cont,to_focus,anim_en);
}

/*
Create fragment manager instance Fragment manager instance 
*/
lv_fragment_manager_t * stub_lv_fragment_manager_create(lv_fragment_t * parent) {
    return lv_fragment_manager_create(parent);
}

/*
Destroy fragment manager instance 
*/
void stub_lv_fragment_manager_delete(lv_fragment_manager_t * manager) {
    lv_fragment_manager_delete(manager);
}

/*
Create object of all fragments managed by this manager. 
*/
void stub_lv_fragment_manager_create_obj(lv_fragment_manager_t * manager) {
    lv_fragment_manager_create_obj(manager);
}

/*
Delete object created by all fragments managed by this manager. Instance of fragments will not be deleted. 
*/
void stub_lv_fragment_manager_delete_obj(lv_fragment_manager_t * manager) {
    lv_fragment_manager_delete_obj(manager);
}

/*
Attach fragment to manager, and add to container. 
*/
void stub_lv_fragment_manager_add(lv_fragment_manager_t * manager, lv_fragment_t * fragment, lv_obj_t * * container) {
    lv_fragment_manager_add(manager,fragment,container);
}

/*
Detach and destroy fragment. If fragment is in navigation stack, remove from it. 
*/
void stub_lv_fragment_manager_remove(lv_fragment_manager_t * manager, lv_fragment_t * fragment) {
    lv_fragment_manager_remove(manager,fragment);
}

/*
Attach fragment to manager and add to navigation stack. 
*/
void stub_lv_fragment_manager_push(lv_fragment_manager_t * manager, lv_fragment_t * fragment, lv_obj_t * * container) {
    lv_fragment_manager_push(manager,fragment,container);
}

/*
Remove the top-most fragment for stack true if there is fragment to pop 
*/
bool stub_lv_fragment_manager_pop(lv_fragment_manager_t * manager) {
    return lv_fragment_manager_pop(manager);
}

/*
Replace fragment. Old item in the stack will be removed. 
*/
void stub_lv_fragment_manager_replace(lv_fragment_manager_t * manager, lv_fragment_t * fragment, lv_obj_t * * container) {
    lv_fragment_manager_replace(manager,fragment,container);
}

/*
Send event to top-most fragment true if fragment returned true 
*/
bool stub_lv_fragment_manager_send_event(lv_fragment_manager_t * manager, int code, void * userdata) {
    return lv_fragment_manager_send_event(manager,code,userdata);
}

/*
Get stack size of this fragment manager Stack size of this fragment manager 
*/
size_t stub_lv_fragment_manager_get_stack_size(lv_fragment_manager_t * manager) {
    return lv_fragment_manager_get_stack_size(manager);
}

/*
Get top most fragment instance Top most fragment instance 
*/
lv_fragment_t * stub_lv_fragment_manager_get_top(lv_fragment_manager_t * manager) {
    return lv_fragment_manager_get_top(manager);
}

/*
Find first fragment instance in the container First fragment instance in the container 
*/
lv_fragment_t * stub_lv_fragment_manager_find_by_container(lv_fragment_manager_t * manager, lv_obj_t * container) {
    return lv_fragment_manager_find_by_container(manager,container);
}

/*
Get parent fragment Parent fragment instance 
*/
lv_fragment_t * stub_lv_fragment_manager_get_parent_fragment(lv_fragment_manager_t * manager) {
    return lv_fragment_manager_get_parent_fragment(manager);
}

/*
Create a fragment instance. 

Fragment instance  
*/
lv_fragment_t * stub_lv_fragment_create(lv_fragment_class_t * cls, void * args) {
    return lv_fragment_create(cls,args);
}

/*
Destroy a fragment. 
*/
void stub_lv_fragment_delete(lv_fragment_t * fragment) {
    lv_fragment_delete(fragment);
}

/*
Get associated manager of this fragment Fragment manager instance 
*/
lv_fragment_manager_t * stub_lv_fragment_get_manager(lv_fragment_t * fragment) {
    return lv_fragment_get_manager(fragment);
}

/*
Get container object of this fragment Reference to container object 
*/
lv_obj_t * * stub_lv_fragment_get_container(lv_fragment_t * fragment) {
    return lv_fragment_get_container(fragment);
}

/*
Get parent fragment of this fragment Parent fragment 
*/
lv_fragment_t * stub_lv_fragment_get_parent(lv_fragment_t * fragment) {
    return lv_fragment_get_parent(fragment);
}

/*
Create object by fragment. 

Created object  
*/
lv_obj_t * stub_lv_fragment_create_obj(lv_fragment_t * fragment, lv_obj_t * container) {
    return lv_fragment_create_obj(fragment,container);
}

/*
Delete created object of a fragment 
*/
void stub_lv_fragment_delete_obj(lv_fragment_t * fragment) {
    lv_fragment_delete_obj(fragment);
}

/*
Destroy obj in fragment, and recreate them. 
*/
void stub_lv_fragment_recreate_obj(lv_fragment_t * fragment) {
    lv_fragment_recreate_obj(fragment);
}

lv_obj_t * stub_lv_file_explorer_create(lv_obj_t * parent) {
    return lv_file_explorer_create(parent);
}

/*
Set file_explorer 
*/
void stub_lv_file_explorer_set_quick_access_path(lv_obj_t * obj, lv_file_explorer_dir_t dir, char * path) {
    lv_file_explorer_set_quick_access_path(obj,dir,path);
}

/*
Set file_explorer sort 
*/
void stub_lv_file_explorer_set_sort(lv_obj_t * obj, lv_file_explorer_sort_t sort) {
    lv_file_explorer_set_sort(obj,sort);
}

/*
Get file explorer Selected file pointer to the file explorer selected file name 
*/
char * stub_lv_file_explorer_get_selected_file_name(lv_obj_t * obj) {
    return lv_file_explorer_get_selected_file_name(obj);
}

/*
Get file explorer cur path pointer to the file explorer cur path 
*/
char * stub_lv_file_explorer_get_current_path(lv_obj_t * obj) {
    return lv_file_explorer_get_current_path(obj);
}

/*
Get file explorer head area obj pointer to the file explorer head area obj(lv_obj) 
*/
lv_obj_t * stub_lv_file_explorer_get_header(lv_obj_t * obj) {
    return lv_file_explorer_get_header(obj);
}

/*
Get file explorer head area obj pointer to the file explorer quick access area obj(lv_obj) 
*/
lv_obj_t * stub_lv_file_explorer_get_quick_access_area(lv_obj_t * obj) {
    return lv_file_explorer_get_quick_access_area(obj);
}

/*
Get file explorer path obj(label) pointer to the file explorer path obj(lv_label) 
*/
lv_obj_t * stub_lv_file_explorer_get_path_label(lv_obj_t * obj) {
    return lv_file_explorer_get_path_label(obj);
}

/*
Get file explorer places list obj(lv_list) pointer to the file explorer places list obj(lv_list) 
*/
lv_obj_t * stub_lv_file_explorer_get_places_list(lv_obj_t * obj) {
    return lv_file_explorer_get_places_list(obj);
}

/*
Get file explorer device list obj(lv_list) pointer to the file explorer device list obj(lv_list) 
*/
lv_obj_t * stub_lv_file_explorer_get_device_list(lv_obj_t * obj) {
    return lv_file_explorer_get_device_list(obj);
}

/*
Get file explorer file list obj(lv_table) pointer to the file explorer file table obj(lv_table) 
*/
lv_obj_t * stub_lv_file_explorer_get_file_table(lv_obj_t * obj) {
    return lv_file_explorer_get_file_table(obj);
}

/*
Set file_explorer sort the current mode from 'lv_file_explorer_sort_t' 
*/
lv_file_explorer_sort_t stub_lv_file_explorer_get_sort(lv_obj_t * obj) {
    return lv_file_explorer_get_sort(obj);
}

/*
Open a specified path 
*/
void stub_lv_file_explorer_open_dir(lv_obj_t * obj, char * dir) {
    lv_file_explorer_open_dir(obj,dir);
}

/*
Initialize the binary image decoder module 
*/
void stub_lv_bin_decoder_init(void) {
    lv_bin_decoder_init();
}

/*
Get info about a lvgl binary image LV_RESULT_OK: the info is successfully stored in header ; LV_RESULT_INVALID: unknown format or other error. 
*/
lv_result_t stub_lv_bin_decoder_info(lv_image_decoder_t * decoder, lv_image_decoder_dsc_t * dsc, lv_image_header_t * header) {
    return lv_bin_decoder_info(decoder,dsc,header);
}

lv_result_t stub_lv_bin_decoder_get_area(lv_image_decoder_t * decoder, lv_image_decoder_dsc_t * dsc, lv_area_t * full_area, lv_area_t * decoded_area) {
    return lv_bin_decoder_get_area(decoder,dsc,full_area,decoded_area);
}

/*
Open a lvgl binary image LV_RESULT_OK: the info is successfully stored in header ; LV_RESULT_INVALID: unknown format or other error. 
*/
lv_result_t stub_lv_bin_decoder_open(lv_image_decoder_t * decoder, lv_image_decoder_dsc_t * dsc) {
    return lv_bin_decoder_open(decoder,dsc);
}

/*
Close the pending decoding. Free resources etc. 
*/
void stub_lv_bin_decoder_close(lv_image_decoder_t * decoder, lv_image_decoder_dsc_t * dsc) {
    lv_bin_decoder_close(decoder,dsc);
}

void stub_lv_bmp_init(void) {
    lv_bmp_init();
}

void stub_lv_bmp_deinit(void) {
    lv_bmp_deinit();
}

void stub_lv_fs_stdio_init(void) {
    lv_fs_stdio_init();
}

gd_GIF * stub_gd_open_gif_file(char * fname) {
    return gd_open_gif_file(fname);
}

gd_GIF * stub_gd_open_gif_data(void * data) {
    return gd_open_gif_data(data);
}

void stub_gd_render_frame(gd_GIF * gif, uint8_t * buffer) {
    gd_render_frame(gif,buffer);
}

int stub_gd_get_frame(gd_GIF * gif) {
    return gd_get_frame(gif);
}

void stub_gd_rewind(gd_GIF * gif) {
    gd_rewind(gif);
}

void stub_gd_close_gif(gd_GIF * gif) {
    gd_close_gif(gif);
}

/*
Create a gif object pointer to the gif obj 
*/
lv_obj_t * stub_lv_gif_create(lv_obj_t * parent) {
    return lv_gif_create(parent);
}

/*
Set the gif data to display on the object 
*/
void stub_lv_gif_set_src(lv_obj_t * obj, void * src) {
    lv_gif_set_src(obj,src);
}

/*
Restart a gif animation. 
*/
void stub_lv_gif_restart(lv_obj_t * obj) {
    lv_gif_restart(obj);
}

/*
Pause a gif animation. 
*/
void stub_lv_gif_pause(lv_obj_t * obj) {
    lv_gif_pause(obj);
}

/*
Resume a gif animation. 
*/
void stub_lv_gif_resume(lv_obj_t * obj) {
    lv_gif_resume(obj);
}

/*
Checks if the GIF was loaded correctly. 
*/
bool stub_lv_gif_is_loaded(lv_obj_t * obj) {
    return lv_gif_is_loaded(obj);
}

/*
Get the loop count for the GIF. 
*/
int32_t stub_lv_gif_get_loop_count(lv_obj_t * obj) {
    return lv_gif_get_loop_count(obj);
}

/*
Set the loop count for the GIF. 
*/
void stub_lv_gif_set_loop_count(lv_obj_t * obj, int32_t count) {
    lv_gif_set_loop_count(obj,count);
}

/*
Create an empty QR code (an lv_canvas ) object. pointer to the created QR code object 
*/
lv_obj_t * stub_lv_qrcode_create(lv_obj_t * parent) {
    return lv_qrcode_create(parent);
}

/*
Set QR code size. 
*/
void stub_lv_qrcode_set_size(lv_obj_t * obj, int32_t size) {
    lv_qrcode_set_size(obj,size);
}

/*
Set QR code dark color. 
*/
void stub_lv_qrcode_set_dark_color(lv_obj_t * obj, lv_color_t color) {
    lv_qrcode_set_dark_color(obj,color);
}

/*
Set QR code light color. 
*/
void stub_lv_qrcode_set_light_color(lv_obj_t * obj, lv_color_t color) {
    lv_qrcode_set_light_color(obj,color);
}

/*
Set the data of a QR code object LV_RESULT_OK: if no error; LV_RESULT_INVALID: on error 
*/
lv_result_t stub_lv_qrcode_update(lv_obj_t * obj, void * data, uint32_t data_len) {
    return lv_qrcode_update(obj,data,data_len);
}

/*
Create a font from the specified file or path with the specified line height. a font object 
*/
lv_font_t * stub_lv_tiny_ttf_create_file(char * path, int32_t font_size) {
    return lv_tiny_ttf_create_file(path,font_size);
}

/*
Create a font from the specified file or path with the specified line height with the specified cache size. a font object 
*/
lv_font_t * stub_lv_tiny_ttf_create_file_ex(char * path, int32_t font_size, lv_font_kerning_t kerning, size_t cache_size) {
    return lv_tiny_ttf_create_file_ex(path,font_size,kerning,cache_size);
}

/*
Create a font from the specified data pointer with the specified line height. a font object 
*/
lv_font_t * stub_lv_tiny_ttf_create_data(void * data, size_t data_size, int32_t font_size) {
    return lv_tiny_ttf_create_data(data,data_size,font_size);
}

/*
Create a font from the specified data pointer with the specified line height and the specified cache size. 
*/
lv_font_t * stub_lv_tiny_ttf_create_data_ex(void * data, size_t data_size, int32_t font_size, lv_font_kerning_t kerning, size_t cache_size) {
    return lv_tiny_ttf_create_data_ex(data,data_size,font_size,kerning,cache_size);
}

/*
Set the size of the font to a new font_size the font bitmap cache and glyph cache will be flushed. 
*/
void stub_lv_tiny_ttf_set_size(lv_font_t * font, int32_t font_size) {
    lv_tiny_ttf_set_size(font,font_size);
}

/*
Destroy a font previously created with lv_tiny_ttf_create_xxxx() 
*/
void stub_lv_tiny_ttf_destroy(lv_font_t * font) {
    lv_tiny_ttf_destroy(font);
}

/*
Initialize a triangle draw descriptor 
*/
void stub_lv_draw_triangle_dsc_init(lv_draw_triangle_dsc_t * draw_dsc) {
    lv_draw_triangle_dsc_init(draw_dsc);
}

/*
Try to get a triangle draw descriptor from a draw task. the task's draw descriptor or NULL if the task is not of type LV_DRAW_TASK_TYPE_TRIANGLE 
*/
lv_draw_triangle_dsc_t * stub_lv_draw_task_get_triangle_dsc(lv_draw_task_t * task) {
    return lv_draw_task_get_triangle_dsc(task);
}

/*
Create a triangle draw task 
*/
void stub_lv_draw_triangle(lv_layer_t * layer, lv_draw_triangle_dsc_t * draw_dsc) {
    lv_draw_triangle(layer,draw_dsc);
}

/*
Initialize the SW renderer. Called in internally. It creates as many SW renderers as defined in LV_DRAW_SW_DRAW_UNIT_CNT 
*/
void stub_lv_draw_sw_init(void) {
    lv_draw_sw_init();
}

/*
Deinitialize the SW renderers 
*/
void stub_lv_draw_sw_deinit(void) {
    lv_draw_sw_deinit();
}

/*
Fill an area using SW render. Handle gradient and radius. 
*/
void stub_lv_draw_sw_fill(lv_draw_unit_t * draw_unit, lv_draw_fill_dsc_t * dsc, lv_area_t * coords) {
    lv_draw_sw_fill(draw_unit,dsc,coords);
}

/*
Draw border with SW render. 
*/
void stub_lv_draw_sw_border(lv_draw_unit_t * draw_unit, lv_draw_border_dsc_t * dsc, lv_area_t * coords) {
    lv_draw_sw_border(draw_unit,dsc,coords);
}

/*
Draw box shadow with SW render. 
*/
void stub_lv_draw_sw_box_shadow(lv_draw_unit_t * draw_unit, lv_draw_box_shadow_dsc_t * dsc, lv_area_t * coords) {
    lv_draw_sw_box_shadow(draw_unit,dsc,coords);
}

/*
Draw an image with SW render. It handles image decoding, tiling, transformations, and recoloring. 
*/
void stub_lv_draw_sw_image(lv_draw_unit_t * draw_unit, lv_draw_image_dsc_t * draw_dsc, lv_area_t * coords) {
    lv_draw_sw_image(draw_unit,draw_dsc,coords);
}

/*
Draw a label with SW render. 
*/
void stub_lv_draw_sw_label(lv_draw_unit_t * draw_unit, lv_draw_label_dsc_t * dsc, lv_area_t * coords) {
    lv_draw_sw_label(draw_unit,dsc,coords);
}

/*
Draw an arc with SW render. 
*/
void stub_lv_draw_sw_arc(lv_draw_unit_t * draw_unit, lv_draw_arc_dsc_t * dsc, lv_area_t * coords) {
    lv_draw_sw_arc(draw_unit,dsc,coords);
}

/*
Draw a line with SW render. 
*/
void stub_lv_draw_sw_line(lv_draw_unit_t * draw_unit, lv_draw_line_dsc_t * dsc) {
    lv_draw_sw_line(draw_unit,dsc);
}

/*
Blend a layer with SW render 
*/
void stub_lv_draw_sw_layer(lv_draw_unit_t * draw_unit, lv_draw_image_dsc_t * draw_dsc, lv_area_t * coords) {
    lv_draw_sw_layer(draw_unit,draw_dsc,coords);
}

/*
Draw a triangle with SW render. 
*/
void stub_lv_draw_sw_triangle(lv_draw_unit_t * draw_unit, lv_draw_triangle_dsc_t * dsc) {
    lv_draw_sw_triangle(draw_unit,dsc);
}

/*
Mask out a rectangle with radius from a current layer 
*/
void stub_lv_draw_sw_mask_rect(lv_draw_unit_t * draw_unit, lv_draw_mask_rect_dsc_t * dsc, lv_area_t * coords) {
    lv_draw_sw_mask_rect(draw_unit,dsc,coords);
}

/*
Used internally to get a transformed are of an image 
*/
void stub_lv_draw_sw_transform(lv_draw_unit_t * draw_unit, lv_area_t * dest_area, void * src_buf, int32_t src_w, int32_t src_h, int32_t src_stride, lv_draw_image_dsc_t * draw_dsc, lv_draw_image_sup_t * sup, lv_color_format_t cf, void * dest_buf) {
    lv_draw_sw_transform(draw_unit,dest_area,src_buf,src_w,src_h,src_stride,draw_dsc,sup,cf,dest_buf);
}

/*
Swap the upper and lower byte of an RGB565 buffer. Might be required if a 8bit parallel port or an SPI port send the bytes in the wrong order. The bytes will be swapped in place. 
*/
void stub_lv_draw_sw_rgb565_swap(void * buf, uint32_t buf_size_px) {
    lv_draw_sw_rgb565_swap(buf,buf_size_px);
}

/*
Invert a draw buffer in the I1 color format. Conventionally, a bit is set to 1 during blending if the luminance is greater than 127. Depending on the display controller used, you might want to have different behavior. The inversion will be performed in place. 
*/
void stub_lv_draw_sw_i1_invert(void * buf, uint32_t buf_size) {
    lv_draw_sw_i1_invert(buf,buf_size);
}

/*
Rotate a buffer into another buffer 
*/
void stub_lv_draw_sw_rotate(void * src, void * dest, int32_t src_width, int32_t src_height, int32_t src_stride, int32_t dest_stride, lv_display_rotation_t rotation, lv_color_format_t color_format) {
    lv_draw_sw_rotate(src,dest,src_width,src_height,src_stride,dest_stride,rotation,color_format);
}

void stub_lv_draw_sw_mask_init(void) {
    lv_draw_sw_mask_init();
}

void stub_lv_draw_sw_mask_deinit(void) {
    lv_draw_sw_mask_deinit();
}

lv_draw_sw_mask_res_t stub_lv_draw_sw_mask_apply(void * masks[], lv_opa_t * mask_buf, int32_t abs_x, int32_t abs_y, int32_t len) {
    return lv_draw_sw_mask_apply(masks,mask_buf,abs_x,abs_y,len);
}

/*
Free the data from the parameter. It's called inside lv_draw_sw_mask_remove_id and lv_draw_sw_mask_remove_custom Needs to be called only in special cases when the mask is not added by lv_draw_mask_add and not removed by lv_draw_mask_remove_id or lv_draw_mask_remove_custom 
*/
void stub_lv_draw_sw_mask_free_param(void * p) {
    lv_draw_sw_mask_free_param(p);
}

/*
Initialize a line mask from two points. 
*/
void stub_lv_draw_sw_mask_line_points_init(lv_draw_sw_mask_line_param_t * param, int32_t p1x, int32_t p1y, int32_t p2x, int32_t p2y, lv_draw_sw_mask_line_side_t side) {
    lv_draw_sw_mask_line_points_init(param,p1x,p1y,p2x,p2y,side);
}

/*
Initialize a line mask from a point and an angle. 
*/
void stub_lv_draw_sw_mask_line_angle_init(lv_draw_sw_mask_line_param_t * param, int32_t px, int32_t py, int16_t angle, lv_draw_sw_mask_line_side_t side) {
    lv_draw_sw_mask_line_angle_init(param,px,py,angle,side);
}

/*
Initialize an angle mask. 
*/
void stub_lv_draw_sw_mask_angle_init(lv_draw_sw_mask_angle_param_t * param, int32_t vertex_x, int32_t vertex_y, int32_t start_angle, int32_t end_angle) {
    lv_draw_sw_mask_angle_init(param,vertex_x,vertex_y,start_angle,end_angle);
}

/*
Initialize a fade mask. 
*/
void stub_lv_draw_sw_mask_radius_init(lv_draw_sw_mask_radius_param_t * param, lv_area_t * rect, int32_t radius, bool inv) {
    lv_draw_sw_mask_radius_init(param,rect,radius,inv);
}

/*
Initialize a fade mask. 
*/
void stub_lv_draw_sw_mask_fade_init(lv_draw_sw_mask_fade_param_t * param, lv_area_t * coords, lv_opa_t opa_top, int32_t y_top, lv_opa_t opa_bottom, int32_t y_bottom) {
    lv_draw_sw_mask_fade_init(param,coords,opa_top,y_top,opa_bottom,y_bottom);
}

/*
Initialize a map mask. 
*/
void stub_lv_draw_sw_mask_map_init(lv_draw_sw_mask_map_param_t * param, lv_area_t * coords, lv_opa_t * map) {
    lv_draw_sw_mask_map_init(param,coords,map);
}

/*
Call the blend function of the layer . 
*/
void stub_lv_draw_sw_blend(lv_draw_unit_t * draw_unit, lv_draw_sw_blend_dsc_t * dsc) {
    lv_draw_sw_blend(draw_unit,dsc);
}

/*
Get the theme assigned to the display of the object the theme of the object's display (can be NULL) 
*/
lv_theme_t * stub_lv_theme_get_from_obj(lv_obj_t * obj) {
    return lv_theme_get_from_obj(obj);
}

/*
Apply the active theme on an object 
*/
void stub_lv_theme_apply(lv_obj_t * obj) {
    lv_theme_apply(obj);
}

/*
Set a base theme for a theme. The styles from the base them will be added before the styles of the current theme. Arbitrary long chain of themes can be created by setting base themes. 
*/
void stub_lv_theme_set_parent(lv_theme_t * new_theme, lv_theme_t * parent) {
    lv_theme_set_parent(new_theme,parent);
}

/*
Set an apply callback for a theme. The apply callback is used to add styles to different objects 
*/
void stub_lv_theme_set_apply_cb(lv_theme_t * theme, lv_theme_apply_cb_t apply_cb) {
    lv_theme_set_apply_cb(theme,apply_cb);
}

/*
Get the small font of the theme pointer to the font 
*/
lv_font_t * stub_lv_theme_get_font_small(lv_obj_t * obj) {
    return lv_theme_get_font_small(obj);
}

/*
Get the normal font of the theme pointer to the font 
*/
lv_font_t * stub_lv_theme_get_font_normal(lv_obj_t * obj) {
    return lv_theme_get_font_normal(obj);
}

/*
Get the subtitle font of the theme pointer to the font 
*/
lv_font_t * stub_lv_theme_get_font_large(lv_obj_t * obj) {
    return lv_theme_get_font_large(obj);
}

/*
Get the primary color of the theme the color 
*/
lv_color_t stub_lv_theme_get_color_primary(lv_obj_t * obj) {
    return lv_theme_get_color_primary(obj);
}

/*
Get the secondary color of the theme the color 
*/
lv_color_t stub_lv_theme_get_color_secondary(lv_obj_t * obj) {
    return lv_theme_get_color_secondary(obj);
}

/*
Initialize the theme a pointer to reference this theme later 
*/
lv_theme_t * stub_lv_theme_default_init(lv_display_t * disp, lv_color_t color_primary, lv_color_t color_secondary, bool dark, lv_font_t * font) {
    return lv_theme_default_init(disp,color_primary,color_secondary,dark,font);
}

/*
Get default theme a pointer to default theme, or NULL if this is not initialized 
*/
lv_theme_t * stub_lv_theme_default_get(void) {
    return lv_theme_default_get();
}

/*
Check if default theme is initialized true if default theme is initialized, false otherwise 
*/
bool stub_lv_theme_default_is_inited(void) {
    return lv_theme_default_is_inited();
}

/*
Deinitialize the default theme 
*/
void stub_lv_theme_default_deinit(void) {
    lv_theme_default_deinit();
}

/*
Initialize the theme a pointer to reference this theme later 
*/
lv_theme_t * stub_lv_theme_mono_init(lv_display_t * disp, bool dark_bg, lv_font_t * font) {
    return lv_theme_mono_init(disp,dark_bg,font);
}

/*
Check if the theme is initialized true if default theme is initialized, false otherwise 
*/
bool stub_lv_theme_mono_is_inited(void) {
    return lv_theme_mono_is_inited();
}

/*
Deinitialize the mono theme 
*/
void stub_lv_theme_mono_deinit(void) {
    lv_theme_mono_deinit();
}

/*
Initialize the theme a pointer to reference this theme later 
*/
lv_theme_t * stub_lv_theme_simple_init(lv_display_t * disp) {
    return lv_theme_simple_init(disp);
}

/*
Check if the theme is initialized true if default theme is initialized, false otherwise 
*/
bool stub_lv_theme_simple_is_inited(void) {
    return lv_theme_simple_is_inited();
}

/*
Get simple theme a pointer to simple theme, or NULL if this is not initialized 
*/
lv_theme_t * stub_lv_theme_simple_get(void) {
    return lv_theme_simple_get();
}

/*
Deinitialize the simple theme 
*/
void stub_lv_theme_simple_deinit(void) {
    lv_theme_simple_deinit();
}

uint32_t stub_lv_task_handler(void) {
    return lv_task_handler();
}

/*
Move the object to the foreground. It will look like if it was created as the last child of its parent. It also means it can cover any of the siblings. 
*/
void stub_lv_obj_move_foreground(lv_obj_t * obj) {
    lv_obj_move_foreground(obj);
}

/*
Move the object to the background. It will look like if it was created as the first child of its parent. It also means any of the siblings can cover the object. 
*/
void stub_lv_obj_move_background(lv_obj_t * obj) {
    lv_obj_move_background(obj);
}

int stub_lv_version_major(void) {
    return lv_version_major();
}

int stub_lv_version_minor(void) {
    return lv_version_minor();
}

int stub_lv_version_patch(void) {
    return lv_version_patch();
}

char * stub_lv_version_info(void) {
    return lv_version_info();
}

